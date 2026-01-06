const repo = "outfit-calendar";

const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: process.env.GITHUB_PAGES === "true" ? `/${repo}` : "",
  assetPrefix: process.env.GITHUB_PAGES === "true" ? `/${repo}/` : "",
};

export default nextConfig;