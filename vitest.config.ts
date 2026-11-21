import { configDefaults, defineConfig } from "vitest/config";
import { TOOL_IDENTITY } from "./src/domain/rule-set/tool-identity.ts";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, "delivery/install-proof/consumer-proof/**", "src/infrastructure/command-line/documentation/walkthrough/**"],
    name: TOOL_IDENTITY.packageName,
    testTimeout: 30_000,
  },
});
