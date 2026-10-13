"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  waBackendFetch,
  type WaIntegrationPublic,
} from "@/lib/whatsapp/backend";
import { requireAdmin as requireAdminRole } from "@/lib/auth-utils";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const result = await requireAdminRole();
  if (!result.ok) throw new Error(result.message);
  return { userId: result.userId, admin: createAdminClient() };
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

export type SendMessageResult =
  | { ok: true; message: WaMessage }
  | { ok: false; message: string };

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function getContacts(): Promise<WaContact[]> {
  const { admin } = await requireAdmin();

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

  return (data ?? [])
    .map((c: Record<string, unknown>) => {
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
    })
    .sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
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

export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const { admin } = await requireAdmin();
  const { error } = await admin.from("wa_messages").delete().eq("id", messageId);
  if (error) return { ok: false, message: "Erro ao apagar mensagem." };
  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true };
}

export async function clearChat(contactId: string): Promise<ActionResult> {
  const { admin } = await requireAdmin();
  const { error } = await admin
    .from("wa_messages")
    .delete()
    .eq("contact_id", contactId);
  if (error) return { ok: false, message: "Erro ao limpar conversa." };
  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true };
}

// ── Send message ──────────────────────────────────────────────────────────────

export async function sendMessage(
  contactId: string,
  content: string,
): Promise<SendMessageResult> {
  const { userId, admin } = await requireAdmin();

  if (!content.trim()) return { ok: false, message: "Mensagem vazia." };

  const { data: contact } = await admin
    .from("wa_contacts")
    .select("phone")
    .eq("id", contactId)
    .single();

  if (!contact) return { ok: false, message: "Contato não encontrado." };

  const phoneDigits = (contact.phone as string).replace(/\D/g, "");
  if (
    !phoneDigits.startsWith("55") ||
    phoneDigits.length < 12 ||
    phoneDigits.length > 13
  ) {
    return {
      ok: false,
      message:
        "Telefone do contato inválido. Reimporte os contatos ou corrija o número.",
    };
  }

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

  try {
    const result = await waBackendFetch<{ waMessageId: string }>(
      "/api/v1/whatsapp/send",
      {
        method: "POST",
        body: JSON.stringify({ phone: contact.phone, content: content.trim() }),
      },
    );

    const { data: updated, error: updErr } = await admin
      .from("wa_messages")
      .update({ status: "sent", wa_message_id: result.waMessageId })
      .eq("id", msg.id)
      .select(
        "id, contact_id, direction, content, status, wa_message_id, sent_by, created_at",
      )
      .single();

    if (updErr || !updated) {
      return { ok: false, message: "Erro ao atualizar mensagem enviada." };
    }

    return { ok: true, message: updated as WaMessage };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao enviar via WhatsApp.";
    await admin.from("wa_messages").update({ status: "failed" }).eq("id", msg.id);
    return { ok: false, message };
  }
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

  let content = template.content_template as string;
  (input.variableValues ?? []).forEach((val, i) => {
    content = content.replace(`{{${i + 1}}}`, val);
  });

  const contacts = (await resolveBroadcastContacts(admin, input.group)).filter((c) =>
    isValidBrazilPhone(c.phone),
  );

  if (contacts.length === 0) {
    return {
      ok: false,
      message:
        "Nenhum contato válido para este grupo. Importe contatos na aba Conexão ou Caixa de Entrada.",
    };
  }

  const contactIds = contacts.map((c) => c.id);

  const rows = contactIds.map((cid) => ({
    contact_id: cid,
    direction: "outbound" as const,
    content,
    status: "pending" as const,
    sent_by: userId,
  }));

  const { data: inserted, error } = await admin
    .from("wa_messages")
    .insert(rows)
    .select("id, contact_id");

  if (error || !inserted) {
    return { ok: false, message: "Erro ao registrar mensagens." };
  }

  const phoneByContact = new Map(contacts.map((c) => [c.id, c.phone]));
  let sent = 0;
  let lastError = "";

  for (const row of inserted) {
    const phone = phoneByContact.get(row.contact_id);
    if (!phone) continue;
    try {
      const result = await waBackendFetch<{ waMessageId: string }>(
        "/api/v1/whatsapp/send",
        { method: "POST", body: JSON.stringify({ phone, content }) },
      );
      await admin
        .from("wa_messages")
        .update({ status: "sent", wa_message_id: result.waMessageId })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Erro ao enviar.";
      await admin.from("wa_messages").update({ status: "failed" }).eq("id", row.id);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  if (sent === 0) {
    return {
      ok: false,
      message:
        lastError ||
        "Nenhuma mensagem enviada. Verifique se o WhatsApp está conectado.",
    };
  }

  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true, sent };
}

// ── Integration (whatsapp-web.js) ─────────────────────────────────────────────

export async function getIntegration(): Promise<WaIntegrationPublic> {
  await requireAdmin();
  try {
    return await waBackendFetch<WaIntegrationPublic>("/api/v1/whatsapp/status");
  } catch {
    return {
      status: "disconnected",
      connected: false,
      display_phone: null,
      qr_code: null,
      connected_at: null,
    };
  }
}

export async function connectWhatsApp(): Promise<
  WaIntegrationPublic | { ok: false; message: string }
> {
  await requireAdmin();
  try {
    const status = await waBackendFetch<WaIntegrationPublic>(
      "/api/v1/whatsapp/connect",
      { method: "POST" },
    );
    revalidatePath("/dashboard/marketing/whatsapp");
    return status;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao conectar WhatsApp.",
    };
  }
}

export async function disconnectWhatsApp(): Promise<
  WaIntegrationPublic | { ok: false; message: string }
> {
  await requireAdmin();
  try {
    const status = await waBackendFetch<WaIntegrationPublic>(
      "/api/v1/whatsapp/disconnect",
      { method: "POST" },
    );
    revalidatePath("/dashboard/marketing/whatsapp");
    return status;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao desconectar WhatsApp.",
    };
  }
}

function toE164Phone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";
  const normalized = d.startsWith("55") ? d : `55${d}`;
  if (normalized.length < 12 || normalized.length > 13) return "";
  return `+${normalized}`;
}

function isValidBrazilPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) return false;
  const national = digits.slice(2);
  return national.length >= 10 && national.length <= 11;
}

async function resolveBroadcastContacts(
  admin: ReturnType<typeof createAdminClient>,
  group: BroadcastGroup,
): Promise<{ id: string; phone: string }[]> {
  if (group === "all" || group === "opted_in") {
    const q = admin.from("wa_contacts").select("id, phone");
    if (group === "opted_in") q.eq("opt_in", true);
    const { data } = await q;
    return (data ?? []) as { id: string; phone: string }[];
  }

  if (group === "active") {
    const { data: subs } = await admin
      .from("gym_subscriptions")
      .select("student_id")
      .eq("status", "active");
    const studentIds = (subs ?? []).map((s: { student_id: string }) => s.student_id);
    if (studentIds.length === 0) return [];
    const { data } = await admin
      .from("wa_contacts")
      .select("id, phone")
      .in("student_id", studentIds);
    return (data ?? []) as { id: string; phone: string }[];
  }

  const { data: inv } = await admin
    .from("gym_invoices")
    .select("student_id")
    .eq("status", "overdue");
  const studentIds = [...new Set((inv ?? []).map((i: { student_id: string }) => i.student_id))];
  if (studentIds.length === 0) return [];
  const { data } = await admin
    .from("wa_contacts")
    .select("id, phone")
    .in("student_id", studentIds);
  return (data ?? []) as { id: string; phone: string }[];
}

export async function getBroadcastContactCount(
  group: BroadcastGroup,
): Promise<number> {
  const { admin } = await requireAdmin();
  const contacts = await resolveBroadcastContacts(admin, group);
  return contacts.filter((c) => isValidBrazilPhone(c.phone)).length;
}

export async function addContact(input: {
  phone: string;
  name?: string;
  optIn?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { admin } = await requireAdmin();

  const phone = toE164Phone(input.phone);
  if (!phone) {
    return {
      ok: false,
      message: "Telefone inválido. Use DDD + número (ex: 11999999999).",
    };
  }

  const { data, error } = await admin
    .from("wa_contacts")
    .upsert(
      {
        phone,
        name: input.name?.trim() || null,
        opt_in: input.optIn ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Erro ao salvar contato." };
  }

  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true, id: data.id as string };
}

export async function importContacts(
  rows: { phone: string; name?: string }[],
): Promise<
  { ok: true; imported: number; skipped: number } | { ok: false; message: string }
> {
  const { admin } = await requireAdmin();

  if (!rows.length) {
    return { ok: false, message: "Nenhum contato para importar." };
  }

  const parsed = rows
    .map((r) => {
      const phone = toE164Phone(r.phone);
      if (!phone) return null;
      return {
        phone,
        name: r.name?.trim() || null,
        opt_in: true,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<{
    phone: string;
    name: string | null;
    opt_in: boolean;
    updated_at: string;
  }>;

  if (parsed.length === 0) {
    return {
      ok: false,
      message: "Nenhum telefone válido encontrado. Use formato brasileiro (DDD + número).",
    };
  }

  const { error } = await admin.from("wa_contacts").upsert(parsed, {
    onConflict: "phone",
  });

  if (error) {
    return { ok: false, message: "Erro ao importar contatos." };
  }

  revalidatePath("/dashboard/marketing/whatsapp");
  return {
    ok: true,
    imported: parsed.length,
    skipped: rows.length - parsed.length,
  };
}

export async function syncContactsFromWhatsApp(): Promise<
  { ok: true; imported: number } | { ok: false; message: string }
> {
  await requireAdmin();
  try {
    const result = await waBackendFetch<{ imported: number }>(
      "/api/v1/whatsapp/sync-contacts",
      { method: "POST" },
    );
    revalidatePath("/dashboard/marketing/whatsapp");
    return { ok: true, imported: result.imported };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Erro ao sincronizar contatos do WhatsApp.",
    };
  }
}

export async function syncContactsFromStudents(): Promise<
  { ok: true; imported: number } | { ok: false; message: string }
> {
  const { admin } = await requireAdmin();

  const { data: students, error } = await admin
    .from("users")
    .select("id, full_name, first_name, phone")
    .eq("role", "customer")
    .not("phone", "is", null);

  if (error) return { ok: false, message: "Erro ao buscar alunos." };

  const rows = (students ?? [])
    .map((s) => {
      const phone = toE164Phone(s.phone as string);
      if (!phone) return null;
      return {
        student_id: s.id as string,
        phone,
        name: (s.first_name as string | null) ?? (s.full_name as string),
        opt_in: true,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<{
    student_id: string;
    phone: string;
    name: string;
    opt_in: boolean;
    updated_at: string;
  }>;

  if (rows.length === 0) {
    return { ok: false, message: "Nenhum aluno com telefone cadastrado." };
  }

  const { error: upsertErr } = await admin.from("wa_contacts").upsert(rows, {
    onConflict: "phone",
  });

  if (upsertErr) return { ok: false, message: "Erro ao importar contatos." };

  revalidatePath("/dashboard/marketing/whatsapp");
  return { ok: true, imported: rows.length };
}
