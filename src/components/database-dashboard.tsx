"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, App, Badge, Button, Descriptions, Drawer, Empty, Form, Input,
  Select, Skeleton, Spin, Table, Tag, Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowRightOutlined, CheckCircleOutlined, CloudServerOutlined, CodeOutlined,
  DatabaseOutlined, EyeOutlined, GithubOutlined, InfoCircleOutlined, LinkOutlined,
  LoadingOutlined, LogoutOutlined, ReloadOutlined, SearchOutlined,
  SettingOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { databaseConfig, demoRows, displayValue, isConfigured, type DatabaseRow } from "@/lib/database";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { useTableCatalog } from "@/hooks/use-table-catalog";
import { useDatabaseRealtime } from "@/hooks/use-database-realtime";
import type { ChangeEvent } from "@/lib/database-events";
import { identifyRows, tableId, type TableDefinition } from "@/lib/table-catalog";
import { TablePicker } from "@/components/table-picker";

const demoTable: TableDefinition = { schema: "public", name: "sample_records", primaryKey: ["id"] };
const selectionStorageKey = `db-domain:selected-table:v2:${databaseConfig.url}`;
type DisplayRow = ReturnType<typeof identifyRows<DatabaseRow>>[number];

const timeLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value))
  : "—";

type Connection = { client: SupabaseClient | null; session: Session | null; ready: boolean; error: string | null };

export function DatabaseDashboard() {
  const [connection, setConnection] = useState<Connection>({ client: null, session: null, ready: false, error: null });

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      const client = getSupabaseClient()!;
      let authEventReceived = false;
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        authEventReceived = true;
        if (active) setConnection({ client, session, ready: true, error: null });
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void client.auth.getSession().then(({ data, error }) => {
        if (active && !authEventReceived) setConnection({ client, session: data.session, ready: true, error: error?.message ?? null });
      }).catch(() => {
        if (active) setConnection({ client, session: null, ready: true, error: "ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาลองโหลดหน้าใหม่" });
      });
    } catch {
      queueMicrotask(() => {
        if (active) setConnection({ client: null, session: null, ready: true, error: "การตั้งค่า Supabase ไม่ถูกต้อง กรุณาตรวจสอบ Project URL และ Publishable key" });
      });
    }
    return () => { active = false; unsubscribe?.(); };
  }, []);

  if (!isConfigured) return <DashboardView demo rows={demoRows} total={demoRows.length} definition={demoTable} />;
  if (!connection.ready) return <CenteredPanel><Spin indicator={<LoadingOutlined spin />} /><p className="mt-4 text-slate-500">กำลังตรวจสอบการเชื่อมต่อ…</p></CenteredPanel>;
  if (connection.error || !connection.client) return <CenteredPanel><Alert type="error" showIcon title="เชื่อมต่อไม่สำเร็จ" description={connection.error} /></CenteredPanel>;
  if (databaseConfig.requireAuth && !connection.session) return <LoginScreen client={connection.client} />;
  return <LiveDashboard key={connection.session?.user.id ?? "anonymous"} client={connection.client} session={connection.session} />;
}

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-5"><div className="surface w-full max-w-md p-8 text-center">{children}</div></main>;
}

function LoginScreen({ client }: { client: SupabaseClient }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function login(values: { email: string; password: string }) {
    setBusy(true); setError(null);
    try {
      const { error } = await client.auth.signInWithPassword(values);
      if (error) setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน หรือสถานะบัญชีของคุณ");
    } catch { setError("เชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }
  async function loginWithGitHub() {
    setBusy(true); setError(null);
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.origin },
      });
      if (error) setError(`เริ่ม Login ด้วย GitHub ไม่ได้: ${error.message} ตรวจว่าเปิด GitHub provider ใน Supabase Auth แล้ว`);
    } catch { setError("เชื่อมต่อ GitHub Login ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }
  return (
    <CenteredPanel>
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-xl text-white"><DatabaseOutlined /></div>
      <p className="eyebrow">DB DOMAIN</p>
      <h1 className="mt-2 text-2xl font-semibold">เข้าสู่ระบบเพื่อดูข้อมูล</h1>
      <p className="mt-3 mb-7 text-sm leading-6 text-slate-500">ใช้บัญชีที่ได้รับสิทธิ์ใน Supabase ของโปรเจกต์นี้</p>
      {error && <Alert type="error" showIcon title={error} className="mb-5 text-left" />}
      <Button block loading={busy} icon={<GithubOutlined />} onClick={loginWithGitHub} className="mb-5">Continue with GitHub</Button>
      <div className="mb-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />หรือเข้าสู่ระบบด้วยอีเมล<span className="h-px flex-1 bg-slate-200" /></div>
      <Form layout="vertical" onFinish={login} requiredMark={false} className="text-left">
        <Form.Item name="email" label="อีเมล" rules={[{ required: true, type: "email", message: "กรุณากรอกอีเมลให้ถูกต้อง" }]}>
          <Input type="email" autoComplete="username" placeholder="you@example.com" />
        </Form.Item>
        <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true, message: "กรุณากรอกรหัสผ่าน" }]}>
          <Input.Password autoComplete="current-password" placeholder="รหัสผ่านของคุณ" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={busy} icon={<ArrowRightOutlined />} iconPlacement="end">เข้าสู่ระบบ</Button>
      </Form>
    </CenteredPanel>
  );
}

function LiveDashboard({ client, session }: { client: SupabaseClient; session: Session | null }) {
  const catalog = useTableCatalog(client);
  const tables = catalog.tables;
  const realtime = useDatabaseRealtime(client, tables.length ? tables.map((table) => table.schema) : [databaseConfig.schema]);
  const [selectedId, setSelectedId] = useState(() => tableId({ schema: databaseConfig.schema, name: databaseConfig.table }));
  const { message } = App.useApp();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(selectionStorageKey);
      if (stored) setSelectedId(stored);
    } catch { /* Invalid or unavailable storage never prevents opening the database. */ }
  }, []);

  function selectTable(table: TableDefinition) {
    const id = tableId(table);
    setSelectedId(id);
    try { window.localStorage.setItem(selectionStorageKey, id); } catch { /* Selection still works without storage. */ }
  }

  async function signOut() {
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch { void message.error("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่"); }
  }
  if (!tables.length && catalog.loading) return <CenteredPanel><Spin /><p className="mt-4 text-slate-500">กำลังโหลดรายชื่อตารางจาก Supabase…</p></CenteredPanel>;
  if (!tables.length) return <CenteredPanel>
    <h1 className="mb-4 text-xl font-semibold">เชื่อมต่อทุกตาราง</h1>
    {catalog.error ? <Alert type="warning" showIcon title={catalog.error} /> : <Empty description="ยังไม่มีตารางใน public" />}
    <p className="my-5 text-left text-sm leading-7 text-slate-500">ตั้งค่าครั้งแรก: ดาวน์โหลด SQL แล้วเปิด Supabase → SQL Editor → New query → วางทั้งหมด → Run จากนั้นกดโหลดรายชื่อใหม่</p>
    <div className="flex flex-wrap justify-center gap-3"><Button href="/api/setup-sql">ดาวน์โหลด SQL ตั้งค่า</Button><Button type="primary" loading={catalog.loading} onClick={catalog.refresh}>โหลดรายชื่อใหม่</Button></div>
    {session && <Button type="text" className="mt-4" onClick={signOut}>ออกจากระบบ</Button>}
  </CenteredPanel>;
  const definition = tables.find((table) => tableId(table) === selectedId) ?? tables[0];
  const revision = definition.isPartitioned ? realtime.schemaRevisions[definition.schema] : realtime.revisions[tableId(definition)];
  return <LiveTable key={JSON.stringify(definition)} client={client} definition={definition}
    realtime={realtime} revision={`${realtime.connectionVersion}:${revision ?? 0}`}
    onSelectEvent={(event) => { const table = tables.find((table) => table.schema === event.schema && table.name === event.table); if (table) selectTable(table); else catalog.refresh(); }}
    tablePicker={<>
      {catalog.error && <Alert type="warning" showIcon title="อัปเดตรายชื่อตารางไม่สำเร็จ" description={catalog.error} />}
      <TablePicker tables={tables} selected={definition} onSelect={selectTable} onRefresh={catalog.refresh} loading={catalog.loading} />
      {definition.canRead === false && <Alert type="warning" showIcon title="บัญชีนี้ยังไม่มีสิทธิ์ SELECT ตารางนี้" description="ให้ผู้ดูแลกำหนดสิทธิ์อ่านสำหรับบัญชีนี้ แล้วกดโหลดรายชื่อใหม่" />}
      {definition.realtimeEnabled === false && <Alert type="warning" showIcon title="ตารางนี้ยังไม่ได้เปิด Realtime" description="รัน setup-db-explorer.sql อีกครั้งเพื่อเพิ่มตารางใหม่ที่รองรับเข้า publication" />}
    </>}
    userEmail={session?.user.email} onSignOut={session ? signOut : undefined} />;
}

function LiveTable({ client, definition, tablePicker, userEmail, onSignOut, realtime, revision, onSelectEvent }: {
  client: SupabaseClient; definition: TableDefinition; tablePicker: React.ReactNode;
  userEmail?: string; onSignOut?: () => void;
  realtime: ReturnType<typeof useDatabaseRealtime>; revision: string; onSelectEvent: (event: ChangeEvent) => void;
}) {
  const table = useRealtimeTable(client, definition, revision);
  return <DashboardView {...table} {...realtime} demo={false} definition={definition} tablePicker={tablePicker}
    onRefresh={table.refresh} userEmail={userEmail} onSignOut={onSignOut} onSelectEvent={onSelectEvent} />;
}

type DashboardProps = {
  demo: boolean; rows: DatabaseRow[]; total: number; loading?: boolean;
  status?: "connecting" | "subscribed" | "error";
  queryError?: string | null; realtimeError?: string | null; updatedAt?: string | null;
  events?: ChangeEvent[]; eventCount?: number; onRefresh?: () => void;
  userEmail?: string; onSignOut?: () => void;
  definition: TableDefinition; tablePicker?: React.ReactNode;
  onSelectEvent?: (event: ChangeEvent) => void;
};

function DashboardView({
  demo, rows, total, loading = false, status = "connecting", queryError, realtimeError,
  updatedAt = null, events = [], eventCount = 0, onRefresh, userEmail, onSignOut,
  definition, tablePicker, onSelectEvent,
}: DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const tableName = definition.name;
  const displayRows = useMemo(() => identifyRows(rows, definition.primaryKey), [rows, definition]);
  const columnNames = useMemo(() => [...new Set([...(definition.columns ?? []), ...rows.flatMap(Object.keys)])], [rows, definition]);
  const statusOptions = useMemo(() => [...new Set(rows.map((row) => row.status).filter((value): value is string => typeof value === "string"))], [rows]);
  const filteredRows = useMemo(() => displayRows.filter(({ data: row }) => (
    (!statusFilter || row.status === statusFilter)
    && Object.values(row).some((value) => displayValue(value).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  )), [displayRows, search, statusFilter]);
  const selectedRow = displayRows.find((row) => row.key === selected)?.data;
  const connectionLabel = demo ? "ข้อมูลตัวอย่าง" : status === "subscribed" ? "Realtime เชื่อมต่อแล้ว" : status === "error" ? "Realtime ขาดการเชื่อมต่อ" : "กำลังเชื่อมต่อ Realtime";

  const columns: ColumnsType<DisplayRow> = columnNames.map((name) => ({
    title: <span className="font-mono text-xs">{name}</span>, dataIndex: ["data", name], key: name,
    width: definition.primaryKey.includes(name) ? 100 : 210, ellipsis: true,
    sorter: (a, b) => typeof a.data[name] === "number" && typeof b.data[name] === "number"
      ? (a.data[name] as number) - (b.data[name] as number)
      : displayValue(a.data[name]).localeCompare(displayValue(b.data[name])),
    render: (value: unknown) => name === "status" && typeof value === "string"
      ? <Tag color={value === "active" ? "green" : value === "pending" ? "gold" : "default"}>{value}</Tag>
      : <span className={definition.primaryKey.includes(name) ? "font-mono text-xs text-slate-400" : "text-[13px]"}>{displayValue(value)}</span>,
  }));
  columns.push({
    title: "", key: "details", width: 64, fixed: "right",
    render: (_value, row, index) => <Tooltip title="ดูรายละเอียด"><Button type="text" size="small" aria-label={`ดูรายละเอียดรายการที่ ${index + 1}`} icon={<EyeOutlined />} onClick={() => setSelected(row.key)} /></Tooltip>,
  });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-lg text-white"><DatabaseOutlined /></div>
          <div><p className="text-base font-bold tracking-tight">DB Domain<span className="text-emerald-600">.</span></p><p className="mt-0.5 text-[10px] tracking-[0.12em] text-slate-400">DATABASE WORKSPACE</p></div>
        </div>
        <div className="hidden px-4 lg:block">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="flex items-center gap-2 text-xs font-semibold"><CloudServerOutlined className="text-emerald-600" /> Supabase project</div><p className="mt-2 truncate font-mono text-[11px] text-slate-400">{demo ? "ยังไม่ได้เชื่อมต่อโปรเจกต์" : definition.schema}</p></div>
          <p className="eyebrow mt-8 mb-3 px-2">WORKSPACE</p>
        </div>
        <nav aria-label="เมนูหลัก" className="flex gap-2 px-4 pb-4 lg:flex-col">
          <a href="#data-table" aria-current="page" className="flex flex-1 items-center gap-3 rounded-lg bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-800"><DatabaseOutlined /> ตารางข้อมูล</a>
          <button onClick={() => setSettingsOpen(true)} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-500 transition hover:bg-slate-50"><SettingOutlined /> การเชื่อมต่อ</button>
        </nav>
        <div className="mt-auto hidden p-4 lg:block">
          <div className="rounded-xl bg-slate-50 p-4"><ThunderboltOutlined className="text-emerald-600" /><p className="mt-3 text-xs font-semibold">อัปเดตตามข้อมูลของคุณ</p><p className="mt-2 text-xs leading-5 text-slate-400">ติดตามการเปลี่ยนแปลงของฐานข้อมูลได้ในหน้าเดียว</p></div>
          <div className="mt-5 flex items-center gap-2 px-2 text-xs text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Next.js · Ant Design</div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-slate-400"><span>Workspace</span><span>/</span><span className="text-slate-700">Database Explorer</span></div>
          <div className="flex items-center gap-3">
            <span role="status" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs"><Badge status={demo ? "default" : status === "subscribed" ? "success" : status === "error" ? "error" : "processing"} /> <span className="ml-1 text-slate-600">{connectionLabel}</span></span>
            {onSignOut && <Tooltip title={userEmail}><Button aria-label="ออกจากระบบ" icon={<LogoutOutlined />} onClick={onSignOut} /></Tooltip>}
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-6 px-5 py-7 sm:px-8 sm:py-9">
          <section className="flex flex-wrap items-end justify-between gap-5">
            <div><p className="eyebrow mb-3">YOUR DATA, IN FOCUS</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">ภาพรวมฐานข้อมูล</h1><p className="mt-3 text-sm leading-6 text-slate-500">ดูข้อมูล ค้นหารายการ และติดตามการเปลี่ยนแปลงแบบ Realtime</p></div>
            <Button icon={demo ? <LinkOutlined /> : <ReloadOutlined />} type={demo ? "primary" : "default"} loading={loading} onClick={demo ? () => setSettingsOpen(true) : onRefresh}>{demo ? "ตั้งค่าการเชื่อมต่อ" : "รีเฟรชข้อมูล"}</Button>
          </section>

          {demo && <Alert type="info" showIcon title="กำลังแสดงข้อมูลตัวอย่าง" description="ยังไม่ได้เชื่อมต่อฐานข้อมูลจริง ตั้งค่า Supabase เพื่อแสดงข้อมูลของคุณและเปิดใช้งาน Realtime" />}
          {queryError && <Alert type="error" showIcon title="โหลดข้อมูลไม่สำเร็จ" description={`${queryError} · หากเคยโหลดสำเร็จ ข้อมูลด้านล่างเป็นข้อมูลจากครั้งก่อน`} />}
          {realtimeError && <Alert type="warning" showIcon title={realtimeError} />}

          {tablePicker}

          <section aria-label="สรุปข้อมูล" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label={demo ? "รายการตัวอย่างทั้งหมด" : "รายการที่คุณมีสิทธิ์อ่าน"} value={loading && !updatedAt ? "…" : total.toLocaleString("en-US")} detail={demo ? "สำหรับทดลองหน้าเว็บ" : "จำนวนแถวทั้งหมดตามสิทธิ์ของคุณ"} icon={<DatabaseOutlined />} />
            <Metric label="รายการที่โหลดมา" value={String(rows.length)} detail={`แสดงสูงสุด ${databaseConfig.rowLimit} รายการ`} icon={<CodeOutlined />} />
            <Metric label="การเปลี่ยนแปลงทุกตาราง" value={demo ? "—" : String(eventCount)} detail={demo ? "เริ่มนับเมื่อเชื่อมต่อฐานข้อมูล" : "รวมทุกตารางตั้งแต่เปิดหน้านี้"} icon={<ThunderboltOutlined />} />
            <Metric label="โหลดข้อมูลสำเร็จล่าสุด" value={timeLabel(updatedAt)} detail={demo ? "ยังไม่มีการซิงก์ข้อมูลจริง" : "เวลาไทย · UTC+7"} icon={<CheckCircleOutlined />} />
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section id="data-table" className="surface min-w-0 overflow-hidden scroll-mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><DatabaseOutlined /></div><div><h2 className="font-mono text-sm font-semibold">{tableName}</h2><p className="mt-1 text-xs text-slate-400">{demo ? "ตารางตัวอย่าง" : definition.schema} <span className="mx-1">·</span> {columnNames.length} คอลัมน์</p></div></div>
                <Tag variant="filled">อ่านอย่างเดียว</Tag>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Input aria-label="ค้นหาในรายการที่โหลดมา" placeholder="ค้นหาในรายการที่โหลดมา…" prefix={<SearchOutlined className="text-slate-400" />} value={search} onChange={(event) => setSearch(event.target.value)} allowClear className="w-full sm:max-w-xs" />
                {statusOptions.length > 0 && <Select aria-label="กรองสถานะ" placeholder="ทุกสถานะ" allowClear value={statusFilter} onChange={setStatusFilter} options={statusOptions.map((value) => ({ value, label: value }))} className="min-w-36" />}
                <span className="ml-auto text-xs text-slate-400">{filteredRows.length} รายการ</span>
              </div>
              {loading && !rows.length ? <div className="p-6"><Skeleton active paragraph={{ rows: 6 }} /></div> : <Table<DisplayRow>
                key={`${search}:${statusFilter ?? ""}`} columns={columns} dataSource={filteredRows}
                rowKey="key" size="middle" loading={loading}
                scroll={{ x: Math.max(700, columnNames.length * 180) }}
                pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50], className: "px-5" }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search || statusFilter ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ไม่มีข้อมูลที่อ่านได้ในตารางนี้"} /> }}
              />}
              <div className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-[11px] leading-5 text-slate-400"><InfoCircleOutlined className="mt-1" /><span>ค้นหา กรอง และเรียงเฉพาะข้อมูลที่โหลดมา สูงสุด {databaseConfig.rowLimit} รายการ{!demo && (definition.orderColumn || definition.primaryKey.length ? ` · เรียงตาม ${definition.orderColumn || definition.primaryKey.join(", ")} จากมากไปน้อย` : " · ยังไม่ได้กำหนดลำดับจากฐานข้อมูล")}</span></div>
            </section>

            <section className="surface overflow-hidden" aria-label="การเปลี่ยนแปลงล่าสุด">
              <div className="border-b border-slate-100 px-5 py-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><ThunderboltOutlined className="text-emerald-600" /> Realtime ทุกตาราง</h2><p className="mt-2 text-xs text-slate-400">คลิกชื่อตารางเพื่อเปิดดูข้อมูล</p></div>
              {events.length ? <ul className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto px-5">{events.map((event) => <li key={event.id} className="py-4"><div className="flex items-center justify-between"><Tag color={event.type === "INSERT" ? "green" : event.type === "DELETE" ? "red" : "blue"}>{event.type}</Tag><span className="font-mono text-[10px] text-slate-400">{timeLabel(event.time)}</span></div><button onClick={() => onSelectEvent?.(event)} className="mt-2 max-w-full cursor-pointer truncate text-left font-mono text-xs text-emerald-700 hover:underline">{event.schema}.{event.table}</button></li>)}</ul> : <div className="px-6 py-10 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-xl text-slate-300"><ThunderboltOutlined /></div><p className="text-xs font-medium text-slate-500">{demo ? "ยังไม่มีเหตุการณ์จริง" : "ยังไม่ได้รับการเปลี่ยนแปลง"}</p><p className="mt-2 text-xs leading-5 text-slate-400">{demo ? "เชื่อมต่อ Supabase เพื่อเริ่มติดตามข้อมูล" : "ติดตามเหตุการณ์จากทุกตารางที่เปิด Realtime และบัญชีนี้มีสิทธิ์เข้าถึง"}</p></div>}
              <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400">แสดง 50 เหตุการณ์ล่าสุด · ไม่ใช่ประวัติย้อนหลัง</div>
            </section>
          </div>
          <footer className="flex flex-wrap justify-between gap-2 pt-1 text-[11px] text-slate-400"><span>DB Domain / Database Explorer</span><span>Powered by Supabase</span></footer>
        </main>
      </div>

      <Drawer title="รายละเอียดรายการ" open={selected !== null} onClose={() => setSelected(null)} size={560}>
        {selectedRow ? <Descriptions bordered column={1} size="small" items={Object.entries(selectedRow).map(([key, value]) => ({ key, label: <span className="font-mono text-xs">{key}</span>, children: <span className="break-all whitespace-pre-wrap text-sm">{displayValue(value)}</span> }))} /> : <Empty description="รายการนี้ไม่อยู่ในข้อมูลที่โหลดมาแล้ว" />}
      </Drawer>
      <ConnectionDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} demo={demo} definition={definition} />
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="metric"><div className="flex items-center justify-between gap-2"><h2 className="text-xs text-slate-500">{label}</h2><span className="text-slate-400">{icon}</span></div><p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-slate-800">{value}</p><p className="mt-3 text-[11px] leading-5 text-slate-400">{detail}</p></div>;
}

function ConnectionDrawer({ open, onClose, demo, definition }: { open: boolean; onClose: () => void; demo: boolean; definition: TableDefinition }) {
  return <Drawer title="การเชื่อมต่อ Supabase" open={open} onClose={onClose} size={500}>
    <Alert type={demo ? "info" : "success"} showIcon title={demo ? "ยังไม่ได้ตั้งค่าฐานข้อมูลครบ" : "ตั้งค่าโปรเจกต์แล้ว"} description={demo ? "คัดลอก .env.example เป็น .env.local แล้วระบุข้อมูลโปรเจกต์" : `ตาราง ${definition.schema}.${definition.name}`} />
    <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-7 text-slate-600">
      <li>ระบุ Project URL และ Publishable key ใน <code>.env.local</code></li>
      <li>รัน <code>supabase/setup-db-explorer.sql</code> ใน SQL Editor หนึ่งครั้ง เพื่อโหลดรายชื่อและเปิด Realtime ทุกตารางใน <code>public</code></li>
      <li>รายชื่อตารางอัปเดตอัตโนมัติทุก 30 วินาที หากสร้างตารางใหม่ให้รัน SQL อีกครั้งเพื่อเปิด Realtime ให้ตารางใหม่</li>
      <li>กำหนดสิทธิ์ SELECT และ RLS ให้ผู้ใช้ที่ต้องการเข้าดูข้อมูล</li>
      <li>เริ่ม dev server ใหม่ด้วย <code>npm run dev</code></li>
    </ol>
    <p className="mt-6 text-xs leading-6 text-slate-400">ค่าเริ่มต้นกำหนดให้เข้าสู่ระบบด้วยบัญชี Supabase Auth ก่อนดูข้อมูล ดูรายละเอียดการตั้งค่าใน README.md ของโปรเจกต์</p>
    <Button className="mt-5" href="https://supabase.com/docs/guides/realtime/postgres-changes" target="_blank" rel="noreferrer" icon={<LinkOutlined />}>คู่มือ Supabase Realtime</Button>
  </Drawer>;
}
