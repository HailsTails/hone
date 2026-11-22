import { describe, expect, it } from "vitest";
import { moduleExtensionOf, moduleFileForm } from "./module-extension.ts";

describe("moduleExtensionOf", () => {
  it("is .js for a module of a built install", () => {
    expect(moduleExtensionOf({ moduleUrl: "file:///project/node_modules/core/chunks/shared-ab12.js" })).toBe(".js");
  });

  it("is .ts for a module run from source", () => {
    expect(moduleExtensionOf({ moduleUrl: "file:///repo/tools/hone/src/infrastructure/node/modules/install-layout.ts" })).toBe(".ts");
  });
});

describe("moduleFileForm", () => {
  it.each(["piece.ts", "cd1/cd1.eslint-plugin.js"])("is a module file for %j", (text) => {
    expect(moduleFileForm({ text })).toBe("module-file");
  });

  it.each(["piece.mjs", "piece.cjs", "piece", "piece.json"])("is not a module file for %j", (text) => {
    expect(moduleFileForm({ text })).toBe("not-module-file");
  });
});
