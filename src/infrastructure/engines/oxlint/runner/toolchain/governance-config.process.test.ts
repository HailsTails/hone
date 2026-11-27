import { describe, expect, it, vi } from "vitest";

import { createGovernanceResolver } from "./governance-config.process.ts";

describe("createGovernanceResolver", () => {
  it("serves the virtual config and leaves every other import to Node", () => {
    const loader = new URL("file:///install/governance.process.js?configuration=.hone-request.mjs");
    const resolve = createGovernanceResolver(loader);
    const context = {};
    const next = vi.fn().mockReturnValue({ url: "file:///repo/other.mjs" });

    const config = resolve("file:///repo/package/.hone-request.mjs?cache=1", context, next);
    const other = resolve("file:///repo/other.mjs", context, next);

    expect(config).toEqual({
      url: "file:///install/governance.process.js?read-configuration",
      shortCircuit: true,
    });
    expect(other).toEqual({ url: "file:///repo/other.mjs" });
    expect(next.mock.calls).toEqual([["file:///repo/other.mjs", context]]);
  });
});
