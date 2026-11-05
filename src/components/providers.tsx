"use client";

import { StyleProvider } from "@ant-design/cssinjs";
import { App, ConfigProvider } from "antd";
import thTH from "antd/locale/th_TH";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StyleProvider layer>
      <ConfigProvider locale={thTH} theme={{
        token: {
          colorPrimary: "#118568", colorInfo: "#118568", borderRadius: 9,
          colorText: "#1d2939", colorBorder: "#e2e8f0",
          fontFamily: 'Tahoma, Arial, sans-serif', controlHeight: 38,
        },
        components: { Table: { headerBg: "#f8fafc", headerColor: "#64748b", rowHoverBg: "#f2fbf7" } },
      }}>
        <App>{children}</App>
      </ConfigProvider>
    </StyleProvider>
  );
}
