import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { checksProjectionText } from "./checks-projection.ts";
import { INSTALLED_DECLARATION_TEXT as DECLARATION_TEXT } from "../../../../../../tests/installed-declaration-text.ts";
import { type ConsumerFiles, consumerDiagnosticsOn, consumerLocationsOn, ESLINT_LINES, RESOLUTIONS } from "../../../../../../tests/consumer-typing.ts";

const PLUGIN_SPECIFIER = "@hailstails/hone/eslint-plugin";

const CHECKS = [
  { symptom: "S-1", check: "C-1", ruleId: "hone/S-1-C-1", options: [{ maximum: 3 }] },
  { symptom: "S-2", check: "C-2", ruleId: "hone/S-2-C-2", options: [] },
];

const ROOT_PROJECTION = checksProjectionText({
  pluginImport: PLUGIN_SPECIFIER,
  checks: CHECKS,
  answered: [{ symptom: "S-1", check: "C-1", file: repoPathSchema.parse("src/old.ts") }],
});

const PACKAGE_PROJECTION = checksProjectionText({ pluginImport: PLUGIN_SPECIFIER, checks: CHECKS, answered: [] });

const CONFIG_API = "eslint/config";

const ROOT_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import hone from "./hone.eslint.mjs";

export default defineConfig([...hone, { files: ["**/*.ts"], rules: {} }]);
`;

const PACKAGE_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import root from "../../hone.eslint.mjs";
import slice from "./hone.eslint.mjs";

export default defineConfig([...root, ...slice, { files: ["**/*.ts"], rules: {} }]);
`;

const MISUSE = `import hone from "./hone.eslint.mjs";

export const first: string = hone[0];

export const count: string = hone.length;
`;

const DECLARATIONS: ConsumerFiles = { "hone.eslint.d.mts": DECLARATION_TEXT, "packages/a/hone.eslint.d.mts": DECLARATION_TEXT };

const NO_DECLARATIONS: ConsumerFiles = {};

const withEntry = (request: { readonly entry: string; readonly entryText: string; readonly declaration: ConsumerFiles }): ConsumerFiles => ({
  [request.entry]: request.entryText,
  "hone.eslint.mjs": ROOT_PROJECTION,
  "packages/a/hone.eslint.mjs": PACKAGE_PROJECTION,
  ...request.declaration,
});

const NOT_ASSIGNABLE_TO_STRING_FROM_A_CONFIG = {
  file: "misuse.ts",
  code: 2322,
  message: "Type 'Config<RulesConfig>' is not assignable to type 'string'.",
};

const NOT_ASSIGNABLE_TO_STRING_FROM_A_NUMBER = { file: "misuse.ts", code: 2322, message: "Type 'number' is not assignable to type 'string'." };

const NO_DECLARATION_TO_IMPORT = {
  file: "eslint.config.ts",
  code: 7016,
  message: "Could not find a declaration file for module './hone.eslint.mjs'. 'hone.eslint.mjs' implicitly has an 'any' type.",
};

const NOT_A_CONFIG_BLOCK = { file: "eslint.config.mjs", code: 2322 };

const ESLINT_PACKAGE = "eslint";

const PLUGIN_USE = `import type { ESLint, Linter } from "${ESLINT_PACKAGE}";
import hone from "${PLUGIN_SPECIFIER}";

export const plugin: ESLint.Plugin = hone;

export const configs: Linter.Config[] = [{ plugins: { hone } }];
`;

const PLUGIN_USED_AS_A_STRING = `import hone from "${PLUGIN_SPECIFIER}";

export const name: string = hone;
`;

const PLUGIN_NOT_A_STRING = { file: "plugin-misuse.ts", code: 2322, message: "Type 'HonePlugin' is not assignable to type 'string'." };

describe.each(ESLINT_LINES)("a typed ESLint config importing a version 2 projection, compiled in memory against the consumer's own node_modules/eslint on %s, under strict with skipLibCheck off (CD-47: nothing is spawned or written)", (line) => {
  describe.each(RESOLUTIONS)("under %s resolution", (resolution) => {
    it("compiles a .ts config for the root projection with the declaration beside it", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "eslint.config.ts", files: withEntry({ entry: "eslint.config.ts", entryText: ROOT_CONFIG, declaration: DECLARATIONS }) }),
      ).toEqual([]);
    });

    it("compiles a .ts config for a package slice over the root projection with the declarations beside them", () => {
      expect(
        consumerDiagnosticsOn({
          line,
          resolution,
          form: "typescript",
          entry: "packages/a/eslint.config.ts",
          files: withEntry({ entry: "packages/a/eslint.config.ts", entryText: PACKAGE_CONFIG, declaration: DECLARATIONS }),
        }),
      ).toEqual([]);
    });

    it("compiles a checked .mjs config for the root projection with the declaration beside it", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "checked-javascript", entry: "eslint.config.mjs", files: withEntry({ entry: "eslint.config.mjs", entryText: ROOT_CONFIG, declaration: DECLARATIONS }) }),
      ).toEqual([]);
    });

    it("compiles a checked .mjs config for a package slice over the root projection with the declarations beside them", () => {
      expect(
        consumerDiagnosticsOn({
          line,
          resolution,
          form: "checked-javascript",
          entry: "packages/a/eslint.config.mjs",
          files: withEntry({ entry: "packages/a/eslint.config.mjs", entryText: PACKAGE_CONFIG, declaration: DECLARATIONS }),
        }),
      ).toEqual([]);
    });

    it("types the default export as an array of ESLint's own configs, so using it as a string names both ways it is not one", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "misuse.ts", files: withEntry({ entry: "misuse.ts", entryText: MISUSE, declaration: DECLARATIONS }) }),
      ).toEqual([NOT_ASSIGNABLE_TO_STRING_FROM_A_CONFIG, NOT_ASSIGNABLE_TO_STRING_FROM_A_NUMBER]);
    });

    it("leaves a .ts config importing a projection with no type to import when no declaration is beside it", () => {
      expect(
        consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "eslint.config.ts", files: withEntry({ entry: "eslint.config.ts", entryText: ROOT_CONFIG, declaration: NO_DECLARATIONS }) }),
      ).toEqual([NO_DECLARATION_TO_IMPORT]);
    });

    it("leaves a checked .mjs config importing a projection typed as the union of the shapes its blocks have when no declaration is beside it", () => {
      expect(
        consumerLocationsOn({ line, resolution, form: "checked-javascript", entry: "eslint.config.mjs", files: withEntry({ entry: "eslint.config.mjs", entryText: ROOT_CONFIG, declaration: NO_DECLARATIONS }) }),
      ).toEqual([NOT_A_CONFIG_BLOCK, NOT_A_CONFIG_BLOCK]);
    });

    it("takes the shipped plugin declaration as ESLint's plugin type, alone and in a flat config", () => {
      expect(consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "plugin-use.ts", files: { "plugin-use.ts": PLUGIN_USE } })).toEqual([]);
    });

    it("types the shipped plugin's default export as the plugin, not as any", () => {
      expect(consumerDiagnosticsOn({ line, resolution, form: "typescript", entry: "plugin-misuse.ts", files: { "plugin-misuse.ts": PLUGIN_USED_AS_A_STRING } })).toEqual([PLUGIN_NOT_A_STRING]);
    });
  });
});
