const nextConfig = {
  reactCompiler: true,

  outputFileTracingExcludes: {
    "/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
      "./data/**/*",
      "./.git/**/*",
      "./.next/cache/**/*",
      "./node_modules/.cache/**/*",
    ],
    "/api/**/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
      "./data/**/*",
    ],
    "/deep-ml/**/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
      "./data/**/*",
    ],
    "/deep-ml/models/**/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
      "./data/**/*",
    ],
  },
};

export default nextConfig;