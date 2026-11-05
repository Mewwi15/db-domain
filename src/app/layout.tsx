import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "DB Domain · Database Explorer",
  description: "ติดตามข้อมูลจาก Supabase แบบ Realtime",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <head>
        <style>{"@layer theme, base, antd, components, utilities;"}</style>
      </head>
      <body>
        <AntdRegistry><Providers>{children}</Providers></AntdRegistry>
      </body>
    </html>
  );
}
