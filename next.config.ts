import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb", // fotoğraf / teknik doküman yüklemeleri için
    },
  },
};

export default nextConfig;
