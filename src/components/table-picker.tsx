"use client";

import { Button, Select, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { tableId, type TableDefinition } from "@/lib/table-catalog";

export function TablePicker({ tables, selected, onSelect, onRefresh, loading }: {
  tables: TableDefinition[]; selected: TableDefinition;
  onSelect: (table: TableDefinition) => void;
  onRefresh: () => void; loading: boolean;
}) {
  return <section aria-label="เลือกตาราง" className="surface flex flex-wrap items-center gap-3 px-5 py-4">
    <label htmlFor="table-picker" className="text-sm font-medium">ทุกตาราง</label>
    <Select id="table-picker" aria-label="ค้นหาและเลือกตาราง" showSearch={{ optionFilterProp: "label" }}
      value={tableId(selected)} className="min-w-0 flex-1 sm:min-w-64 sm:max-w-md"
      options={tables.map((table) => ({ value: tableId(table), label: `${table.schema}.${table.name}${table.canRead === false ? " · ไม่มีสิทธิ์อ่าน" : ""}` }))}
      onChange={(id) => { const table = tables.find((entry) => tableId(entry) === id); if (table) onSelect(table); }} />
    <span className="text-xs text-slate-500">{tables.length} ตารางจากฐานข้อมูล</span>
    <Tag color="green">เปิด Realtime {tables.filter((table) => table.realtimeEnabled).length}/{tables.length}</Tag>
    <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>โหลดรายชื่อใหม่</Button>
  </section>;
}
