"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendDatabaseEvent, type EventState } from "@/lib/database-events";

type RealtimeState = EventState & {
  status: "connecting" | "subscribed" | "error";
  realtimeError: string | null;
  connectionVersion: number;
};

export function useDatabaseRealtime(client: SupabaseClient, schemas: string[]) {
  const [state, setState] = useState<RealtimeState>({
    events: [], eventCount: 0, revisions: {}, schemaRevisions: {},
    status: "connecting", realtimeError: null, connectionVersion: 0,
  });
  const schemaKey = JSON.stringify([...new Set(schemas)].sort());
  useEffect(() => {
    let disposed = false;
    // Supabase reuses channels by topic. A fresh topic prevents Strict Mode or
    // quick sign-out/sign-in from reusing a channel whose async cleanup is pending.
    const channel = client.channel(`db-domain:all-tables:${crypto.randomUUID()}`);
    setState((previous) => previous.status === "connecting" ? previous : { ...previous, status: "connecting", realtimeError: null });
    for (const schema of JSON.parse(schemaKey) as string[]) {
      // No table filter: monitor every published table in this application schema.
      channel.on("postgres_changes", { event: "*", schema }, (payload) => {
        if (disposed) return;
        setState((previous) => ({ ...previous, ...appendDatabaseEvent(previous, {
          type: payload.eventType, time: new Date().toISOString(),
          schema: payload.schema, table: payload.table,
        }) }));
      });
    }
    channel.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") setState((previous) => ({
        ...previous, status: "subscribed", realtimeError: null,
        connectionVersion: previous.connectionVersion + 1,
      }));
      else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) setState((previous) => ({
        ...previous, status: "error", realtimeError: "Realtime ขาดการเชื่อมต่อ กำลังรอเชื่อมต่อใหม่ คุณยังรีเฟรชข้อมูลเองได้",
      }));
    });
    return () => { disposed = true; void client.removeChannel(channel); };
  }, [client, schemaKey]);
  return state;
}
