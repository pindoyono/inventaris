import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inventaris", template: "%s · Inventaris" },
  description: "Pengelolaan Barang Milik Daerah di sekolah negeri: aset, persediaan, peminjaman, dan laporan.",
  appleWebApp: { capable: true, title: "Inventaris", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // CSP bernonce (proxy.ts) mensyaratkan render dinamis: halaman statis tidak membawa nonce
  await connection();
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col print:bg-white">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
