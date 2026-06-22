import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// ── Meta Cloud API webhook verification (GET) ─────────────────────────────────

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WA_WEBHOOK_SECRET) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── Incoming message webhook (POST) ──────────────────────────────────────────

type MetaWaEntry = {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: Array<{
        id: string;
        from: string;
        timestamp: string;
        type: string;
        text?: { body: string };
      }>;
      statuses?: Array<{
        id: string;
        status: "sent" | "delivered" | "read" | "failed";
      }>;
    };
    field: string;
  }>;
};

type MetaWebhookBody = {
  object: string;
  entry: MetaWaEntry[];
};

export async function POST(req: NextRequest) {
  // Optional: verify X-Hub-Signature-256 for production security
  // For now verify the static token header
  const webhookSecret = process.env.WA_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
    // Allow if no secret is configured (dev mode) or signature present
    if (sigHeader === "" && process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let body: MetaWebhookBody;
  try {
    body = await req.json() as MetaWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true }); // Ignore non-WA events
  }

  const admin = createAdminClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Handle status updates (delivered/read)
      for (const status of value.statuses ?? []) {
        await admin
          .from("wa_messages")
          .update({ status: status.status })
          .eq("wa_message_id", status.id)
          .eq("direction", "outbound");
      }

      // Handle incoming messages
      for (const msg of value.messages ?? []) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        const phone = `+${msg.from}`;
        const content = msg.text.body;
        const contactName =
          value.contacts?.find((c) => c.wa_id === msg.from)?.profile.name ?? null;

        // Upsert contact
        const { data: contact, error: contactErr } = await admin
          .from("wa_contacts")
          .upsert(
            { phone, name: contactName, updated_at: new Date().toISOString() },
            { onConflict: "phone", ignoreDuplicates: false },
          )
          .select("id")
          .single();

        if (contactErr || !contact) {
          console.error("wa webhook: contact upsert failed", contactErr);
          continue;
        }

        // Insert inbound message (idempotent via wa_message_id)
        const { error: msgErr } = await admin.from("wa_messages").upsert(
          {
            contact_id: contact.id,
            direction: "inbound",
            content,
            status: "delivered",
            wa_message_id: msg.id,
            created_at: new Date(Number(msg.timestamp) * 1000).toISOString(),
          },
          { onConflict: "wa_message_id", ignoreDuplicates: true },
        );

        if (msgErr) {
          console.error("wa webhook: message insert failed", msgErr);
        }
      }
    }
  }

  // WhatsApp requires 200 OK within 20s
  return NextResponse.json({ ok: true });
}
