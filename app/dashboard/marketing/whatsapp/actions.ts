"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) throw new Error("Não autorizado.");
  const { data: p } = await auth.from("users").select("role").eq("id", user.id).single();
  if (!p || p.role !== "admin") throw new Error("Permissão insuficiente.");
  return { userId: user.id, admin: createAdminClient() };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type WaContact = {
  id: string;
  student_id: string | null;
  phone: string;
  name: string | null;
  opt_in: boolean;
  created_at: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  student_name: string | null;
};

export type WaMessage = {
  id: string;
  contact_id: string;
  direction: "inbound" | "outbound";
  content: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  wa_message_id: string | null;
  sent_by: string | null;
  created_at: string;
};

export type WaTemplate = {
  id: string;
  name: string;
  content_template: string;
  type: "billing" | "promo" | "welcome" | "reminder";
  variables: string[];
  active: boolean;
};

export type WaAutomation = {
  id: string;
  trigger_type: "renewal_3d" | "renewal_1d" | "birthday" | "welcome" | "overdue";
  template_id: string | null;
  active: boolean;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function getContacts(): Promise<WaContact[]> {
  const { admin } = await requireAdmin();

  // Contacts with their most recent message
  const { data, error } = await admin
    .from("wa_contacts")
    .select(`
      id, student_id, phone, name, opt_in, created_at,
      student:student_id(full_name, first_name),
      wa_messages(content, created_at, direction, status)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getContacts:", error);
    return [];
  }

  return (data ?? []).map((c: Record<string, unknown>) => {
    const msgs = (c.wa_messages as WaMessage[] | null) ?? [];
    const sorted = [...msgs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const last = sorted[0];
    const unread = msgs.filter((m) => m.direction === "inbound" && m.status !== "read").length;
    const st = c.student as { full_name?: string; first_name?: string } | null;
    const studentName = st?.first_name ?? st?.full_name?.toString().split(" ")[0] ?? null;

    return {
      id: c.id as string,
      student_id: c.student_id as string | null,
      phone: c.phone as string,
      name: c.name as string | null,
      opt_in: c.opt_in as boolean,
      created_at: c.created_at as string,
      last_message: last?.content ?? null,
      last_message_at: last?.created_at ?? null,
      unread_count: unread,
      student_name: studentName,
    };
  });
}

export async function getMessages(contactId: string): Promise<WaMessage[]> {
  const { admin } = await requireAdmin();
  const { data, error } = await admin
    .from("wa_messages")
    .select("id, contact_id, direction, content, status, wa_message_id, sent_by, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getMessages:", error);
    return [];
  }
  return (data ?? []) as WaMessage[];
}

export async function markMessagesRead(contactId: string): Promise<void> {
  const { admin } = await requireAdmin();
  await admin
    .from("wa_messages")
    .update({ status: "read" })
    .eq("contact_id", contactId)
    .eq("direction", "inbound")
    .neq("status", "read");
}

// ── Send message ──────────────────────────────────────────────────────────────

export async function sendMessage(
  contactId: string,
  content: string,
): Promise<ActionResult> {
  const { userId, admin } = await requireAdmin();

  if (!content.trim()) return { ok: false, message: "Mensagem vazia." };

  // Get contact phone
  const { data: contact } = await admin
    .from("wa_contacts")
    .select("phone")
    .eq("id", contactId)
    .single();

  if (!contact) return { ok: false, message: "Contato não encontrado." };

  // Insert outbound message in DB
  const { data: msg, error: insErr } = await admin
    .from("wa_messages")
    .insert({
      contact_id: contactId,
      direction: "outbound",
      content: content.trim(),
      status: "pending",
      sent_by: userId,
    })
    .select("id")
    .single();

  if (insErr || !msg) {
    return { ok: false, message: "Erro ao salvar mensagem." };
  }

  // Fire-and-forget call to WhatsApp API provider
  // (Replace with real Meta Cloud API / Twilio / etc.)
  const waToken = process.env.WA_API_TOKEN;
  const waPhoneId = process.env.WA_PHONE_ID;
  if (waToken && waPhoneId) {
    try {
      const payload = {
        messaging_product: "whatsapp",
        to: contact.phone,
        type: "text",
        text: { body: content.trim() },
      };
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${waPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json() as { messages?: Array<{ id: string }> };
      const waId = json.messages?.[0]?.id ?? null;
      if (waId) {
        await admin
          .from("wa_messages")
          .update({ status: "sent", wa_message_id: waId })
          .eq("id", msg.id);
      } else {
        await admin.from("wa_messages").update({ status: "failed" }).eq("id", msg.id);
      }
    } catch (err) {
      console.error("WA send error:", err);
      await admin.from("wa_messages").update({ status: "failed" }).eq("id", msg.id);
    }
  } else {
    // Dev mode: mark as sent immediately
    await admin.from("wa_messages").update({ status: "sent" }).eq("id", msg.id);
  }

  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true };
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<WaTemplate[]> {
  const { admin } = await requireAdmin();
  const { data } = await admin
    .from("wa_templates")
    .select("id, name, content_template, type, variables, active")
    .order("name");
  return (data ?? []) as WaTemplate[];
}

export async function upsertTemplate(input: {
  id?: string;
  name: string;
  content_template: string;
  type: WaTemplate["type"];
  variables: string[];
}): Promise<ActionResult> {
  const { admin } = await requireAdmin();
  const record = {
    name: input.name.trim(),
    content_template: input.content_template.trim(),
    type: input.type,
    variables: input.variables,
    active: true,
  };

  if (input.id) {
    const { error } = await admin
      .from("wa_templates")
      .update(record)
      .eq("id", input.id);
    if (error) return { ok: false, message: "Erro ao atualizar template." };
  } else {
    const { error } = await admin.from("wa_templates").insert(record);
    if (error) return { ok: false, message: "Erro ao criar template." };
  }

  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true };
}

// ── Automations ───────────────────────────────────────────────────────────────

export async function getAutomations(): Promise<WaAutomation[]> {
  const { admin } = await requireAdmin();
  const { data } = await admin
    .from("wa_automations")
    .select("id, trigger_type, template_id, active")
    .order("trigger_type");
  return (data ?? []) as WaAutomation[];
}

export async function toggleAutomation(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const { admin } = await requireAdmin();
  const { error } = await admin
    .from("wa_automations")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "Erro ao atualizar automação." };
  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true };
}

export async function setAutomationTemplate(
  id: string,
  templateId: string,
): Promise<ActionResult> {
  const { admin } = await requireAdmin();
  const { error } = await admin
    .from("wa_automations")
    .update({ template_id: templateId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "Erro ao vincular template." };
  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true };
}

// ── Broadcasts ────────────────────────────────────────────────────────────────

export type BroadcastGroup = "all" | "active" | "overdue" | "opted_in";

export async function sendBroadcast(input: {
  templateId: string;
  group: BroadcastGroup;
  variableValues: string[];
}): Promise<{ ok: true; sent: number } | { ok: false; message: string }> {
  const { userId, admin } = await requireAdmin();

  const { data: template } = await admin
    .from("wa_templates")
    .select("content_template, variables")
    .eq("id", input.templateId)
    .single();

  if (!template) return { ok: false, message: "Template não encontrado." };

  // Build message from template
  let content = template.content_template as string;
  (input.variableValues ?? []).forEach((val, i) => {
    content = content.replace(`{{${i + 1}}}`, val);
  });

  // Resolve audience
  let contactIds: string[] = [];

  if (input.group === "all" || input.group === "opted_in") {
    const q = admin.from("wa_contacts").select("id");
    if (input.group === "opted_in") q.eq("opt_in", true);
    const { data } = await q;
    contactIds = (data ?? []).map((c: { id: string }) => c.id);
  } else if (input.group === "active") {
    // Contacts whose student has an active subscription
    const { data: subs } = await admin
      .from("gym_subscriptions")
      .select("student_id")
      .eq("status", "active");
    const studentIds = (subs ?? []).map((s: { student_id: string }) => s.student_id);
    if (studentIds.length > 0) {
      const { data } = await admin
        .from("wa_contacts")
        .select("id")
        .in("student_id", studentIds);
      contactIds = (data ?? []).map((c: { id: string }) => c.id);
    }
  } else if (input.group === "overdue") {
    // Contacts whose student has overdue invoices
    const { data: inv } = await admin
      .from("gym_invoices")
      .select("student_id")
      .eq("status", "overdue");
    const studentIds = [...new Set((inv ?? []).map((i: { student_id: string }) => i.student_id))];
    if (studentIds.length > 0) {
      const { data } = await admin
        .from("wa_contacts")
        .select("id")
        .in("student_id", studentIds);
      contactIds = (data ?? []).map((c: { id: string }) => c.id);
    }
  }

  if (contactIds.length === 0) {
    return { ok: false, message: "Nenhum contato encontrado para este grupo." };
  }

  // Insert outbound messages in bulk
  const rows = contactIds.map((cid) => ({
    contact_id: cid,
    direction: "outbound" as const,
    content,
    status: "pending" as const,
    sent_by: userId,
  }));

  const { error } = await admin.from("wa_messages").insert(rows);
  if (error) return { ok: false, message: "Erro ao registrar mensagens." };

  // TODO: enqueue actual WA API calls via background job
  // For now, mark all as sent (dev mode)
  const waToken = process.env.WA_API_TOKEN;
  if (!waToken) {
    await admin
      .from("wa_messages")
      .update({ status: "sent" })
      .in("contact_id", contactIds)
      .eq("status", "pending")
      .eq("direction", "outbound");
  }

  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true, sent: contactIds.length };
}
