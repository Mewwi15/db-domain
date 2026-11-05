"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDatabaseCatalog, type TableDefinition } from "@/lib/table-catalog";

export function useTableCatalog(client: SupabaseClient) {
  const [tables, setTables] = useState<TableDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let running = false;
    const abort = new AbortController();
    async function refresh() {
      if (disposed || running) return;
      running = true;
      setLoading(true);
      try {
        const { data, error } = await client.rpc("db_domain_tables")
          .abortSignal(AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]));
        if (error) {
          if (error.code === "PGRST202" || error.code === "42883") throw new Error("ยังไม่ได้ตั้งค่า: รัน setup-db-explorer.sql ใน Supabase SQL Editor หนึ่งครั้ง แล้วกดโหลดรายชื่อใหม่");
          if (error.code === "42501") throw new Error("บัญชีนี้ไม่มีสิทธิ์อ่านรายชื่อตาราง ตรวจสอบการ Login และสิทธิ์เรียก db_domain_tables");
          throw new Error(error.message);
        }
        const next = parseDatabaseCatalog(data);
        if (!disposed) {
          // Preserve definitions when metadata is unchanged to avoid resetting the data view.
          setTables((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
          setError(null);
        }
      } catch (error) {
        if (!disposed) setError(error instanceof Error ? error.message : "โหลดรายชื่อตารางไม่สำเร็จ");
      } finally { running = false; if (!disposed) setLoading(false); }
    }
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", refreshRef.current);
    document.addEventListener("visibilitychange", onVisible);
    const onOnline = refreshRef.current;
    return () => {
      disposed = true; abort.abort(); clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      refreshRef.current = () => {};
    };
  }, [client]);

  return { tables, loading, error, refresh: () => refreshRef.current() };
}
