"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { databaseConfig, type DatabaseRow } from "@/lib/database";
import type { TableDefinition } from "@/lib/table-catalog";

type TableState = {
  rows: DatabaseRow[];
  total: number;
  loading: boolean;
  queryError: string | null;
  updatedAt: string | null;
};

const initialState: TableState = {
  rows: [], total: 0, loading: true, queryError: null, updatedAt: null,
};

// The owning component must be keyed by the table definition so switches reset
// rows, errors and filters before loading a different table. The schema-wide
// subscription and its event history live in the parent workspace.
export function useRealtimeTable(client: SupabaseClient, definition: TableDefinition, revision: string) {
  const [state, setState] = useState<TableState>(initialState);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let running = false;
    let queued = false;
    const abort = new AbortController();
    const { schema, name: table, orderColumn, primaryKey } = definition;
    const { rowLimit } = databaseConfig;

    // Serialize reads. An event during a request queues a new snapshot so a stale
    // response cannot overwrite newer data. Refresh again after every reconnect.
    async function refresh() {
      if (disposed) return;
      if (running) { queued = true; return; }
      running = true;
      setState((previous) => ({ ...previous, loading: true }));
      try {
        let query = client.schema(schema).from(table).select("*", { count: "exact" });
        const orderColumns = [...new Set([...(orderColumn ? [orderColumn] : []), ...primaryKey])];
        for (const column of orderColumns) query = query.order(column, { ascending: false });
        const { data, error, count } = await query.limit(rowLimit).abortSignal(abort.signal);
        if (error) throw error;
        if (!disposed) setState((previous) => ({
          ...previous, rows: data ?? [], total: count ?? data?.length ?? 0,
          queryError: null, updatedAt: new Date().toISOString(),
        }));
      } catch (error) {
        if (!disposed) setState((previous) => ({
          ...previous, queryError: error instanceof Error ? error.message
            : (error as { message?: string })?.message || "ไม่สามารถโหลดข้อมูลได้",
        }));
      } finally {
        running = false;
        if (!disposed) {
          setState((previous) => ({ ...previous, loading: false }));
          if (queued) { queued = false; void refresh(); }
        }
      }
    }

    refreshRef.current = () => { void refresh(); };

    // Reading remains available even when Realtime cannot connect.
    void refresh();
    const onOnline = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      abort.abort();
      refreshRef.current = () => {};
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, definition]);

  // Throttle invalidations without starving reads under a continuous event stream.
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!invalidationTimer.current) invalidationTimer.current = setTimeout(() => {
      invalidationTimer.current = null;
      refreshRef.current();
    }, 200);
  }, [revision]);
  useEffect(() => () => {
    if (invalidationTimer.current) clearTimeout(invalidationTimer.current);
    invalidationTimer.current = null;
  }, []);

  return { ...state, refresh: () => refreshRef.current() };
}
