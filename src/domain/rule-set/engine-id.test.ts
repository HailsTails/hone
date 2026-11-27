import { describe, expect, it } from "vitest";

import { versionOneEngineNameOf } from "./engine-id.ts";
import type { EngineId } from "./identifier-types.ts";

describe("versionOneEngineNameOf", () => {
  it.each<{ readonly engine: EngineId; readonly name: string }>([
    { engine: "walker", name: "audit" },
    { engine: "eslint", name: "eslint" },
    { engine: "oxlint", name: "oxlint" },
  ])("uses the v1 name for $engine", ({ engine, name }) => {
    expect(versionOneEngineNameOf(engine)).toBe(name);
  });
});
