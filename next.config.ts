const nextConfig = {
  reactCompiler: true,

  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
    "/model3/**/*": ["./data/**/*"],
  },

  outputFileTracingExcludes: {
    "/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
      "./.git/**/*",
      "./.next/cache/**/*",
      "./node_modules/.cache/**/*",
    ],
    "/api/**/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
    ],
    "/deep-ml/**/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
    ],
    "/deep-ml/models/**/*": [
      "./artifacts/**/*",
      "./public/artifacts/**/*",
    ],
  },
};

export default nextConfig;
