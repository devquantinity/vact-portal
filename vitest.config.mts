import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://vact:vact@localhost:5432/vact_portal_test",
      SESSION_SECRET: "test-secret-test-secret-test-secret-test-secret",
      APP_URL: "http://localhost:3000",
    },
  },
});
