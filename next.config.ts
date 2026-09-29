import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // lets a phone on the same Wi-Fi open `next dev` via the LAN address
  allowedDevOrigins: ["192.168.1.2"],
};

export default nextConfig;
