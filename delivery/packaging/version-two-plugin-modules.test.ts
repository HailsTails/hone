import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PLUGIN_SPECIFIERS } from "../../src/application/upgrade/patching/version-one-plugin-specifiers.ts";

const PACKAGE_PREFIX = "@hailstails/hone/";

const repositoryFile = (relativePath: string): URL =>
  new URL(`../../${relativePath}`, import.meta.url);

const versionTwoModules = PLUGIN_SPECIFIERS.map(({ versionTwo }) =>
  versionTwo.slice(PACKAGE_PREFIX.length),
);

describe("the version 2 plugin modules a version 1 projection is rewritten to", () => {
  it.each(versionTwoModules)(
    "%s exists in the repository and its piece names it as the plugin module",
    (module) => {
      expect(existsSync(repositoryFile(module.replace(/\.js$/, ".ts")))).toBe(true);
      const piece: unknown = JSON.parse(
        readFileSync(repositoryFile(module.replace(/eslint-plugin\.js$/, "piece.json")), "utf8"),
      );
      expect(piece).toMatchObject({ settings: { pluginModule: "eslint-plugin.ts" } });
    },
  );
});
