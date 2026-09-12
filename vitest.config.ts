import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The server-only guard is a Next.js bundling concern; stub it for
      // plain-Node unit tests.
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pure unit tests never open a connection, but importing server modules
    // constructs the pg Pool, which requires the env var to exist.
    env: {
      DATABASE_URL: "postgresql://unit-test:unit-test@127.0.0.1:5432/unit_test",
    },
  },
});
