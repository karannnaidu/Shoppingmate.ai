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
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
