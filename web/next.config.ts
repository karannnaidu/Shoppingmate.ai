import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@shoppingmate/db",
    "@shoppingmate/shared",
    "@shoppingmate/agent",
    "@shoppingmate/adapters",
    "@shoppingmate/jobs",
    "@shoppingmate/dom-harness",
  ],
};

export default nextConfig;
