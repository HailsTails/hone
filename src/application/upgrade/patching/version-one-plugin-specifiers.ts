import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";

type PluginSpecifier = { readonly versionOne: string; readonly versionTwo: string };

const ESLINT_ENGINE_FOLDER = "src/infrastructure/engines/eslint";

const pluginSpecifierOf = (request: {
  readonly discipline: number;
  readonly versionTwoFolder: string;
}): PluginSpecifier => {
  const stem = `cd${request.discipline}`;
  return {
    versionOne: `${TOOL_IDENTITY.packageName}/mechanisms/eslint/CD-${request.discipline}/${stem}/${stem}.eslint-plugin.js`,
    versionTwo: `${TOOL_IDENTITY.packageName}/${ESLINT_ENGINE_FOLDER}/${request.versionTwoFolder}/eslint-plugin.js`,
  };
};

export const PLUGIN_SPECIFIERS: readonly PluginSpecifier[] = [
  pluginSpecifierOf({ discipline: 1, versionTwoFolder: "untyped-value/explicit-any" }),
  pluginSpecifierOf({ discipline: 2, versionTwoFolder: "claimed-type/non-null-assertions" }),
  pluginSpecifierOf({ discipline: 6, versionTwoFolder: "name-off-its-casing/naming-convention" }),
  pluginSpecifierOf({ discipline: 7, versionTwoFolder: "name-off-its-casing/filename-case" }),
  pluginSpecifierOf({ discipline: 10, versionTwoFolder: "thrown-non-error/throw-only-error" }),
  pluginSpecifierOf({ discipline: 14, versionTwoFolder: "authored-class-or-this/class-keyword" }),
  pluginSpecifierOf({ discipline: 27, versionTwoFolder: "test-switched-off/focused-tests" }),
  pluginSpecifierOf({ discipline: 40, versionTwoFolder: "positional-parameters/parameter-count" }),
  pluginSpecifierOf({ discipline: 41, versionTwoFolder: "tangled-function/cognitive-complexity" }),
  pluginSpecifierOf({
    discipline: 42,
    versionTwoFolder: "work-inside-a-condition/else-after-an-exit",
  }),
  pluginSpecifierOf({ discipline: 44, versionTwoFolder: "rebinding/parameter-reassignment" }),
];

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

export const projectionWithVersionTwoPlugins = (request: { readonly text: string }): string =>
  PLUGIN_SPECIFIERS.reduce(
    (text, specifier) =>
      text.replaceAll(
        quoted({ text: specifier.versionOne }),
        quoted({ text: specifier.versionTwo }),
      ),
    request.text,
  );
