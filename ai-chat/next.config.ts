import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run용 Docker 이미지에 필요한 파일만 .next/standalone에 모은다
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
