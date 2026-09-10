import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too tight for a logo upload (Settings -> Shop
      // Profile, src/app/(app)/settings/shop/actions.ts). Server-side
      // validation there still caps the actual file at a sane size.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
