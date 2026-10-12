"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type RawMessage = {
  id: string;
  gym_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

/**
 * Subscribes to new/deleted team_messages for this gym. Inserts arrive
 * without the sender's display name (RLS-safe raw row), so the consumer
 * resolves it — falling back to a generic label when the sender is unknown
 * (e.g. a teammate who joined mid-session).
 */
export function useTeamChatRealtime(
  gymId: string | null,
  onInsert: (row: RawMessage) => void,
  onDelete: (id: string) => void,
) {
  useEffect(() => {
    if (!gymId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`team-chat-${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `gym_id=eq.${gymId}`,
        },
        (payload) => onInsert(payload.new as RawMessage),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "team_messages",
          filter: `gym_id=eq.${gymId}`,
        },
        (payload) => onDelete((payload.old as { id: string }).id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gymId, onInsert, onDelete]);
}
