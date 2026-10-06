import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventaris — BMD Sekolah Negeri",
    short_name: "Inventaris",
    description: "Pengelolaan Barang Milik Daerah di sekolah negeri: aset, persediaan, peminjaman, laporan.",
    start_url: "/dasbor",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#0f766e",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pindai QR", url: "/pindai" },
      { name: "Peminjaman", url: "/peminjaman" },
    ],
  };
}
