import { describe, expect, it } from "vitest";
import { ENGINE_REGISTRY } from "./engine-registry.ts";

describe("ENGINE_REGISTRY", () => {
  it("names the engine that runs each mechanism", () => {
    expect(ENGINE_REGISTRY).toEqual([
      { name: "walker", mechanism: "audit" },
      { name: "eslint", mechanism: "eslint" },
    ]);
  });
});
