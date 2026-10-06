import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inventaris", template: "%s · Inventaris" },
  description: "Pengelolaan Barang Milik Daerah di sekolah negeri: aset, persediaan, peminjaman, dan laporan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col print:bg-white">{children}</body>
    </html>
  );
}
