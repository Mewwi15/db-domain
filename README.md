# DB Domain

เว็บดูทุกตารางใน `public` ของ Supabase ด้วย Next.js + TypeScript + Tailwind CSS + Ant Design

## เริ่มใช้งานเร็วที่สุด

1. ตั้ง Project URL และ Publishable key ใน `.env.local` (ถ้ามีค่าจริงแล้ว ไม่ต้องคัดลอก `.env.example` ทับ)
2. เปิด `supabase/setup-db-explorer.sql` คัดลอกทั้งหมดไปรันใน **Supabase → SQL Editor → New query** หนึ่งครั้ง
3. เปิด GitHub Login ใน Supabase Auth และตั้ง OAuth callback จากหน้า Supabase ให้ตรงกับ GitHub OAuth App, แล้วรัน `npm run dev -- --port 3001`
4. เปิด http://localhost:3001 แล้วกด **Continue with GitHub**; Supabase ส่งกลับเข้าเว็บและรักษา session ไว้

OAuth ต้องตั้ง GitHub Provider ใน Supabase Auth ก่อน โดยใช้ Client ID และ Client Secret ของ GitHub OAuth App จากนั้นนำ callback URL ที่ Supabase แสดงไปตั้งใน GitHub ให้ตรง และเพิ่ม `http://localhost:3001/**` ในรายการ allowed redirect URLs ของ Supabase Auth สำหรับ local; production ต้องเพิ่มโดเมน production แยกต่างหาก ไม่มีการรับหรือเก็บ GitHub Client Secret ในโค้ดเว็บนี้

GitHub Login จะสร้าง/ค้นหา user identity ใน Supabase Auth เท่านั้น ไม่ได้ทำให้ RLS ให้สิทธิ์อ่านข้อมูลทุกตารางโดยอัตโนมัติ

Node.js 24 LTS แนะนำ; ติดตั้งแพ็กเกจด้วย `npm install` เมื่อยังไม่มี node_modules

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_SCHEMA=public
# เลือกได้ ไม่จำเป็นต้องระบุ:
NEXT_PUBLIC_SUPABASE_TABLE=classrooms
NEXT_PUBLIC_REQUIRE_AUTH=true
```

ค่า NEXT_PUBLIC ถูกฝังตอน build เปลี่ยนค่าแล้วให้ restart dev server หรือ build production ใหม่ ห้ามใช้ Secret key / service_role ในตัวแปร NEXT_PUBLIC

## การทำงาน

- โหลดรายชื่อตาราง คอลัมน์ Primary key (รวม composite key) สิทธิ์ SELECT และสถานะ publication จาก RPC `public.db_domain_tables()` อัตโนมัติทุก 30 วินาทีขณะหน้าเว็บเปิดอยู่
- รายการมาจากฐานข้อมูลจริง ไม่มีรายชื่อ 22 ตารางจากภาพเป็น fallback อีกแล้ว ไม่มีขั้นตอนคัดลอกชื่อ/JSON เอง
- เมนูค้นหาและเลือกได้ทุกตารางใน public รวมตารางที่ว่างหรือตารางที่บัญชียังไม่มีสิทธิ์อ่าน โดยแสดงสถานะสิทธิ์ให้เห็น
- Subscription ฟัง INSERT / UPDATE / DELETE ระดับ schema โดยไม่กรองตาราง จึงรับเหตุการณ์ทุกตารางที่เปิด publication และได้รับอนุญาตตาม Supabase
- หน้าข้อมูลอ่านตารางที่เลือกอยู่สูงสุด 100 แถว และรีเฟรชเมื่อมีเหตุการณ์ของตารางนั้น; partitioned parent จะรีเฟรชเมื่อ schema มีเหตุการณ์ด้วย
- แผง Realtime รวมเหตุการณ์ล่าสุด 50 รายการจากทุกตาราง กดชื่อในเหตุการณ์เพื่อสลับไปดูตารางได้ ประวัติและจำนวนเหตุการณ์ไม่หายเมื่อสลับตาราง
- โหลดข้อมูลใหม่เมื่อเชื่อมต่อ Realtime กลับมา หรือกลับมาเปิดหน้าเว็บ การสลับตารางยกเลิก request เก่าและล้างข้อมูล/ตัวกรอง/รายละเอียดเดิม
- ค้นหา กรอง เรียง และแบ่งหน้าเฉพาะ 100 แถวที่โหลดมา ไม่ใช่ค้นหาทั้งฐานข้อมูล จำนวนรวมเป็นแถวที่บัญชีอ่านได้ตาม RLS
- เก็บแค่ชื่อตารางที่เลือกล่าสุดใน localStorage แยกตาม Project URL; ไม่บันทึกแถวข้อมูลลง localStorage โดยแอปนี้

## SQL ตั้งค่าทำอะไรบ้าง

`supabase/setup-db-explorer.sql` ต้องรันด้วยเจ้าของฐานข้อมูลใน SQL Editor:

1. สร้าง RPC อ่าน metadata ด้วย SECURITY INVOKER และ search_path ว่าง ให้เฉพาะ authenticated เรียกได้
2. เพิ่มตารางถาวรทั้งหมดใน public เข้า publication `supabase_realtime` โดยไม่เพิ่มซ้ำ
3. ตั้ง REPLICA IDENTITY FULL เฉพาะตารางที่ไม่มี replica identity ใช้งานได้ เพื่อให้ UPDATE/DELETE ยังทำงานได้หลังเปิด publication (อาจเพิ่มปริมาณ WAL)
4. Reload schema cache ของ PostgREST

สคริปต์ไม่สร้างบัญชี ไม่ grant SELECT ให้ตาราง ไม่เพิ่มนโยบายอ่านทุกแถว และไม่ปิด RLS ชื่อทุกตารางแสดงได้ แต่ข้อมูลและเหตุการณ์ยังขึ้นกับ grants/RLS ของบัญชีที่ Login หากไม่มีสิทธิ์ให้ผู้ดูแลปรับตามบัญชี/บทบาทที่ต้องการ ไม่ต้องเปิดข้อมูลให้ anon

ขอบเขตเป็นตารางใน **public** ตามโปรเจกต์นี้ ไม่รวม auth, storage หรือ schema ภายในระบบ และไม่รวม views เพราะ Postgres Changes ติดตามการเปลี่ยนแถวของตาราง Unlogged tables ไม่รองรับ publication และจะแสดงว่าไม่ได้เปิด Realtime

หากเพิ่มตารางใหม่ รายชื่อจะปรากฏอัตโนมัติ แต่ต้องรัน SQL ตั้งค่าอีกครั้งเพื่อเพิ่ม publication ให้ตารางใหม่นั้น สคริปต์รันซ้ำได้ ไม่ได้ติดตั้ง DDL trigger ในฐานข้อมูล

## ข้อจำกัดและการตรวจสอบ

```sh
npm test
npm run typecheck
npm run build
```

Tests ใช้ Node.js 22.18+ หรือ 24 ตรวจ catalog, composite key, รายการว่าง, การนับเหตุการณ์ข้ามตาราง และขนาดประวัติที่จำกัด

ทดสอบจริงด้วยบัญชีที่มีสิทธิ์: เลือกตาราง A แล้วเปลี่ยนแถวทดสอบในตาราง B ผ่าน Supabase Dashboard ตรวจว่าเหตุการณ์ B เข้ามา กดเปิด B แล้วตรวจค่า จากนั้นทดสอบเพิ่ม แก้ไข ลบและ reconnect บนข้อมูลทดสอบที่เหมาะสม

การต่อ channel สำเร็จไม่ได้ยืนยันว่าจะได้รับทุกเหตุการณ์ ตัวเลขเปิด Realtime มาจาก publication metadata และสิทธิ์แถวตรวจโดย Supabase ฝั่งเซิร์ฟเวอร์ ประวัติในเว็บไม่ใช่ audit log และไม่มี event ย้อนหลังระหว่าง offline โดยเฉพาะ DELETE มีข้อจำกัดด้าน RLS/ข้อมูลเก่าตามเอกสาร Supabase

การยืนยันข้อมูลหลัง Login และการแสดงผลจริงในเบราว์เซอร์ยังต้องทดสอบในสภาพแวดล้อมของผู้ใช้ โครงนี้ใช้ client-side Supabase Auth ไม่มี SSR session middleware

## ไฟล์หลัก

- `supabase/setup-db-explorer.sql`: ตั้งค่า RPC และ publication ครั้งเดียว
- `src/hooks/use-table-catalog.ts`: โหลด metadata อัตโนมัติ
- `src/hooks/use-database-realtime.ts`: subscription ทุกตาราง
- `src/hooks/use-realtime-table.ts`: โหลด snapshot ของตารางที่เลือก
- `src/components/database-dashboard.tsx`: Login, Dashboard และแผงเหตุการณ์รวม
- `src/components/table-picker.tsx`: เมนูเลือกตารางจาก catalog จริง
- `src/app/api/setup-sql/route.ts`: ดาวน์โหลด SQL ตั้งค่าจากหน้าเว็บ

อ้างอิง: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Database functions](https://supabase.com/docs/guides/database/functions), [Ant Design + Next.js](https://ant.design/docs/react/use-with-next/)
