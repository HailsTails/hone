import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type {
  ModuleLoad,
  ModuleLoaderPort,
} from "../../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import cd27Plugin from "../../../protocol/plugin-rules/test-modifiers.ts";
import type { EslintMajorBoundary } from "../toolchain/eslint-major-boundary.ts";
import type { PluginCheck } from "./check-rule-id.ts";
import { type HonePluginFailure, honePluginAt, honePluginFailureText } from "./hone-plugin.ts";

const SILENT_BOUNDARY: EslintMajorBoundary = {
  nearestLookup: { flags: [] },
  reportDataOf: () => undefined,
  declarationText: "declare const projection: readonly unknown[];\nexport default projection;\n",
};

const SKIPPED_TESTS_CHECK: PluginCheck = {
  name: "skipped-tests",
  symptom: {
    name: "test-switched-off",
    title: "Test switched off",
    ruleSet: "hone",
  },
  engines: [{ name: "eslint" }],
};

const PIECE_FILE =
  "/install/src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json";

const PLUGIN_MODULE_PATH =
  "/install/src/infrastructure/engines/eslint/test-switched-off/focused-tests/eslint-plugin.ts";

const PIECE_TEXT =
  '{"version":2,"anchor":{"kind":"file"},"implementation":{"symptom":"test-switched-off","check":"focused-tests"},"settings":{"rule":"skipped-tests"}}';

const SHARED_PIECE_TEXT =
  '{"version":2,"anchor":{"kind":"keyword","keyword":"only"},"settings":{"pluginNamespace":"hone-cd27","pluginModule":"eslint-plugin.ts","rule":"focused-tests"}}';

const PIECE_READ: ReturnType<FileTextPort["read"]> = { outcome: "ok", value: PIECE_TEXT };

const PLUGIN_LOADED: ModuleLoad = { outcome: "ok", value: { default: cd27Plugin } };

const pluginBuiltFrom = (request: {
  readonly read: ReturnType<FileTextPort["read"]>;
  readonly load: ModuleLoad;
}) => {
  const read = vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce(request.read)
    .mockReturnValueOnce({ outcome: "ok", value: SHARED_PIECE_TEXT });
  const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(request.load);
  const built = honePluginAt({
    checks: [SKIPPED_TESTS_CHECK],
    installRoot: absoluteRootOf("/install"),
    fileText: {
      read,
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      write: vi.fn<FileTextPort["write"]>(),
    },
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    modules: { load },
    boundary: SILENT_BOUNDARY,
  });
  return { built, read, load };
};

describe("honePluginAt", () => {
  it("builds the plugin from the piece of each ESLint check and the plugin module that piece names", async () => {
    expect(await pluginBuiltFrom({ read: PIECE_READ, load: PLUGIN_LOADED }).built).toEqual({
      outcome: "ok",
      value: {
        meta: { name: "@hailstails/hone/eslint-plugin", version: "0.0.0-local" },
        rules: { "test-switched-off#skipped-tests": expect.anything() },
      },
    });
  });

  it("reads the check's piece under the install root", async () => {
    const { built, read } = pluginBuiltFrom({ read: PIECE_READ, load: PLUGIN_LOADED });
    await built;
    expect(read).toHaveBeenCalledWith({ path: PIECE_FILE });
  });

  it("loads the plugin module from beside the piece", async () => {
    const { built, load } = pluginBuiltFrom({ read: PIECE_READ, load: PLUGIN_LOADED });
    await built;
    expect(load).toHaveBeenCalledWith({ path: PLUGIN_MODULE_PATH });
  });

  it("fails naming a piece that cannot be read", async () => {
    expect(
      await pluginBuiltFrom({
        read: {
          outcome: "failed",
          error: { kind: "unreadable", path: PIECE_FILE, detail: "ENOENT" },
        },
        load: PLUGIN_LOADED,
      }).built,
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-unreadable",
        pieceFile: PIECE_FILE,
        detail: "test-switched-off#skipped-tests: ENOENT",
      },
    });
  });

  it("fails naming a piece that is not JSON", async () => {
    expect(
      await pluginBuiltFrom({ read: { outcome: "ok", value: "not json" }, load: PLUGIN_LOADED })
        .built,
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-source-invalid", pieceFile: PIECE_FILE },
    });
  });

  it("fails naming a piece that names no plugin module", async () => {
    expect(
      await pluginBuiltFrom({
        read: { outcome: "ok", value: '{"version":2,"anchor":{"kind":"file"},"settings":{}}' },
        load: PLUGIN_LOADED,
      }).built,
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-source-invalid", pieceFile: PIECE_FILE },
    });
  });

  it("fails naming a plugin module that cannot be loaded", async () => {
    expect(
      await pluginBuiltFrom({
        read: PIECE_READ,
        load: {
          outcome: "failed",
          error: { kind: "module-unloadable", path: PLUGIN_MODULE_PATH, detail: "SyntaxError" },
        },
      }).built,
    ).toEqual({
      outcome: "failed",
      error: { kind: "plugin-unloadable", path: PLUGIN_MODULE_PATH, detail: "SyntaxError" },
    });
  });

  it("fails naming a plugin module that exports nothing", async () => {
    expect(
      await pluginBuiltFrom({ read: PIECE_READ, load: { outcome: "ok", value: "not a module" } })
        .built,
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "plugin-invalid", pieceFile: PIECE_FILE, pluginModule: "eslint-plugin.ts" },
    });
  });

  it("fails naming a plugin module whose default export is not an ESLint plugin", async () => {
    expect(
      await pluginBuiltFrom({
        read: PIECE_READ,
        load: { outcome: "ok", value: { default: { rules: "none" } } },
      }).built,
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "plugin-invalid", pieceFile: PIECE_FILE, pluginModule: "eslint-plugin.ts" },
    });
  });
});

describe("honePluginFailureText", () => {
  it.each<{ readonly failure: HonePluginFailure; readonly text: string }>([
    {
      failure: { kind: "piece-unreadable", pieceFile: PIECE_FILE, detail: "ENOENT" },
      text: "the piece /install/src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json cannot be read: ENOENT",
    },
    {
      failure: {
        kind: "piece-source-invalid",
        pieceFile: PIECE_FILE,
        detail: "clauses: expected array",
      },
      text: "the piece /install/src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json is not an ESLint piece: clauses: expected array",
    },
    {
      failure: { kind: "plugin-unloadable", path: PLUGIN_MODULE_PATH, detail: "SyntaxError" },
      text: "the plugin module /install/src/infrastructure/engines/eslint/test-switched-off/focused-tests/eslint-plugin.ts cannot be loaded: SyntaxError",
    },
    {
      failure: {
        kind: "plugin-invalid",
        pieceFile: PIECE_FILE,
        pluginModule: "eslint-plugin.ts",
        detail: "rules: expected record",
      },
      text: "the plugin module eslint-plugin.ts of the piece /install/src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json is not an ESLint plugin: rules: expected record",
    },
    {
      failure: { kind: "piece-rule-missing", pieceFile: PIECE_FILE, rule: "skipped-tests" },
      text: "the piece /install/src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json runs the rule skipped-tests, which its plugin module does not hold",
    },
    {
      failure: { kind: "check-rule-missing", ruleId: "hone/test-switched-off#skipped-tests" },
      text: "the check hone/test-switched-off#skipped-tests runs on ESLint, but no piece of this install holds its rule",
    },
  ])("says $failure.kind as $text", ({ failure, text }) => {
    expect(honePluginFailureText({ failure })).toBe(text);
  });
});
