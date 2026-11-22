import { assert, describe, expect, it } from "vitest";

import { PLUGIN_SPECIFIERS } from "../../src/application/upgrade/patching/version-one-plugin-specifiers.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";

const PACKAGE_PREFIX = "@hailstails/hone/";

const fileText = createDefaultFileTextPort({});

const repositoryFile = (relativePath: string): string =>
  new URL(`../../${relativePath}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const versionTwoModules = PLUGIN_SPECIFIERS.map(({ versionTwo }) =>
  versionTwo.slice(PACKAGE_PREFIX.length),
);

describe("the version 2 plugin modules a version 1 projection is rewritten to", () => {
  it.each(versionTwoModules)(
    "%s exists in the repository and its piece names it as the plugin module",
    (module) => {
      expect(fileText.exists({ path: repositoryFile(module.replace(/\.js$/, ".ts")) })).toBe(
        "present",
      );
      const pieceText = fileText.read({
        path: repositoryFile(module.replace(/eslint-plugin\.js$/, "piece.json")),
      });
      assert(pieceText.outcome === "ok", "the piece file is readable");
      expect(JSON.parse(pieceText.value)).toMatchObject({
        settings: { pluginModule: "eslint-plugin.ts" },
      });
    },
  );
});
