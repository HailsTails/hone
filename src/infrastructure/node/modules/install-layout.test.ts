import { describe, expect, it } from "vitest";
import { createPathPort } from "../path-port.ts";
import {
  installFormOf,
  installRootAboveEntry,
  moduleExtensionOf,
  moduleFileForm,
  runnerModuleSegmentsOf,
} from "./install-layout.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const directoryOf = (path: string): string => posixPath.directoryOf({ path });

describe("installRootAboveEntry", () => {
  it("is the folder holding src/ for a command entry under src/", () => {
    expect(installRootAboveEntry({ entryFile: "/install/src/hone.js", entry: "command", directoryOf })).toBe(
      "/install",
    );
  });

  it("is the folder holding src/ for a public entry under src/", () => {
    expect(installRootAboveEntry({ entryFile: "/install/src/testing.js", entry: "api", directoryOf })).toBe("/install");
  });

  it("is the folder holding src/ for a runner entry under src/infrastructure/engines/<mechanism>/runner/", () => {
    expect(
      installRootAboveEntry({ entryFile: "/install/src/infrastructure/engines/eslint/runner/runner.ts", entry: "runner", directoryOf }),
    ).toBe("/install");
  });
});

describe("moduleExtensionOf", () => {
  it("is .js for a module of a built install", () => {
    expect(moduleExtensionOf({ moduleUrl: "file:///project/node_modules/core/chunks/shared-ab12.js" })).toBe(".js");
  });

  it("is .ts for a module run from source", () => {
    expect(moduleExtensionOf({ moduleUrl: "file:///repo/tools/hone/src/infrastructure/node/modules/install-layout.ts" })).toBe(".ts");
  });
});

describe("installFormOf", () => {
  it("is a package for built modules", () => {
    expect(installFormOf({ moduleExtension: ".js" })).toBe("package");
  });

  it("is a source checkout for modules run from source", () => {
    expect(installFormOf({ moduleExtension: ".ts" })).toBe("source");
  });
});

describe("runnerModuleSegmentsOf", () => {
  it("names the built runner module in a built install", () => {
    expect(runnerModuleSegmentsOf({ installRoot: "/install", mechanism: "eslint", moduleExtension: ".js" })).toEqual([
      "/install",
      "src",
      "infrastructure",
      "engines",
      "eslint",
      "runner",
      "runner.js",
    ]);
  });

  it("names the source runner module in a source install", () => {
    expect(runnerModuleSegmentsOf({ installRoot: "/install", mechanism: "audit", moduleExtension: ".ts" })).toEqual([
      "/install",
      "src",
      "infrastructure",
      "engines",
      "audit",
      "runner",
      "runner.ts",
    ]);
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
