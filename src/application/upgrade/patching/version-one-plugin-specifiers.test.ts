import { assert, describe, expect, it } from "vitest";

import {
  PLUGIN_SPECIFIERS,
  type PluginSpecifier,
  projectionWithVersionTwoPlugins,
} from "./version-one-plugin-specifiers.ts";

const specifierOf = (discipline: number): PluginSpecifier => {
  const found = PLUGIN_SPECIFIERS[discipline];
  assert(found !== undefined, `the table has an entry at ${discipline}`);
  return found;
};

const importLine = (request: { readonly index: number; readonly specifier: string }): string =>
  ["import", `piece${request.index}`, "from", `"${request.specifier}";`].join(" ");

const projectionImporting = (request: { readonly specifiers: readonly string[] }): string =>
  [
    ...request.specifiers.map((specifier, index) => importLine({ index, specifier })),
    "",
    "export default [",
    "  {",
    '    name: "hone/piece/hone",',
    '    files: ["**/*.{ts,tsx,mts,cts}"],',
    '    plugins: { "hone": piece1 },',
    '    rules: { "hone/no-class-authoring": "error" },',
    "  },",
    "  {",
    '    name: "hone/file-records/CD-14#class-syntax",',
    '    files: ["src/kept.ts"],',
    '    rules: { "hone/no-class-authoring": "off" },',
    "  },",
    "];",
    "",
  ].join("\n");

const FIRST = specifierOf(0);
const SIXTH = specifierOf(5);

const PROJECTION_OF_VERSION_ONE_FIVE = projectionImporting({
  specifiers: [FIRST.versionOne, SIXTH.versionOne],
});

const PROJECTION_OF_VERSION_TWO = projectionImporting({
  specifiers: [FIRST.versionTwo, SIXTH.versionTwo],
});

describe("projectionWithVersionTwoPlugins", () => {
  it("rewrites each version 1 plugin specifier to the version 2 module with the same rules and changes nothing else", () => {
    expect(projectionWithVersionTwoPlugins({ text: PROJECTION_OF_VERSION_ONE_FIVE })).toBe(
      PROJECTION_OF_VERSION_TWO,
    );
  });

  it("leaves a projection that imports no version 1 plugin as it is", () => {
    const text = 'import piece0 from "./local-plugin.js";\n';
    expect(projectionWithVersionTwoPlugins({ text })).toBe(text);
  });
});
