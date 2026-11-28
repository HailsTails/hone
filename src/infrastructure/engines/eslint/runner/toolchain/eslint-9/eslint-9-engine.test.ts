import { describe, expect, it, vi } from "vitest";

import type { ModuleLoaderPort } from "../../../../../../application/ports/host/module-loader-port.ts";
import { eslint9PieceModules } from "./eslint-9-engine.ts";

describe("eslint9PieceModules", () => {
  it("preserves a module that does not supply a native rule factory", async () => {
    const loadedPlugin = { default: { rules: {} } };
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValue({ outcome: "ok", value: loadedPlugin });
    const modules = eslint9PieceModules({ base: { load } });

    const loaded = await modules.load({ path: "/install/module.js" });

    expect(loaded).toEqual({ outcome: "ok", value: loadedPlugin });
  });
});
