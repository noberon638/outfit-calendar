import type { NextConfig } from "next";

const repo = "outfit-calendar";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },

  basePath: process.env.NODE_ENV === "production" ? `/${repo}` : "",
  assetPrefix: process.env.NODE_ENV === "production" ? `/${repo}/` : "",
};

export default nextConfig;