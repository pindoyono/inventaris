import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Dua logo @1 MB per form profil
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
