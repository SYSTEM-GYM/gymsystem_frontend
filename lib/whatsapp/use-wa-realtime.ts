"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WaMessage } from "@/app/dashboard/marketing/whatsapp/actions";

export function useWaInboxRealtime(
  selectedContactId: string | null,
  onContactsChange: () => void,
  onMessageInsert: (msg: WaMessage) => void,
  onMessageUpdate: (msg: WaMessage) => void,
) {
  const contactsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleContactsRefresh = () => {
    if (contactsTimer.current) clearTimeout(contactsTimer.current);
    contactsTimer.current = setTimeout(() => {
      onContactsChange();
    }, 400);
  };

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("wa-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_contacts" },
        () => scheduleContactsRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wa_messages" },
        (payload) => {
          const msg = payload.new as WaMessage;
          if (selectedContactId && msg.contact_id === selectedContactId) {
            onMessageInsert(msg);
          }
          scheduleContactsRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wa_messages" },
        (payload) => {
          const msg = payload.new as WaMessage;
          if (selectedContactId && msg.contact_id === selectedContactId) {
            onMessageUpdate(msg);
          }
          scheduleContactsRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "wa_messages" },
        () => scheduleContactsRefresh(),
      )
      .subscribe();

    return () => {
      if (contactsTimer.current) clearTimeout(contactsTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [
    selectedContactId,
    onContactsChange,
    onMessageInsert,
    onMessageUpdate,
  ]);
}
