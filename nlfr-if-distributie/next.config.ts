import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only secrets are never exposed; only NEXT_PUBLIC_* reach the client.
  reactStrictMode: true,
};

export default nextConfig;
