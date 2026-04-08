import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    coverage: {
      provider: "v8",
      include: ["app/**/*.vue"],
      exclude: ["**/*.spec.ts"],
      thresholds: { 100: true },
      reporter: ["text", "json"],
      reportsDirectory: "coverage",
    },
  },
});