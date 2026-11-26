import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../src/domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../src/domain/rule-set/clause-address.ts";
import {
  checksProjectionText,
  createChecksDeclarationText,
} from "../../../src/infrastructure/engines/eslint/runner/projection/checks-projection.ts";
import { eslintBoundaryFor } from "../../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
  typeScriptPeersNamed,
} from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import type { ConsumerResolution } from "./consumer-types-port.ts";
import { createConsumerTypesPort, createDefaultConsumerTypesPort } from "./consumer-types.ts";
import { createDefaultTypeScriptDeclarationPort } from "./typescript-declaration-port.ts";

const INSTALL_ROOT = `${import.meta.dirname}/../../..`;

const NODE_MODULES = `${INSTALL_ROOT}/node_modules`;

const ESLINT_LINES = [
  { folder: "eslint", version: "10.15.0" },
  { folder: "eslint-9", version: "9.39.5" },
];

const RESOLUTIONS: readonly ConsumerResolution[] = ["bundler", "nodenext"];

const EMITTED_PLUGIN = createDefaultTypeScriptDeclarationPort({}).emit({
  sourceRoot: INSTALL_ROOT,
  entryPoints: ["src/eslint-plugin.ts"],
});

const CONSUMER_PACKAGE = '{ "name": "consumer", "type": "module" }';

const HONE_PACKAGE =
  '{ "name": "@hailstails/hone", "type": "module", "exports": { "./eslint-plugin": { "types": "./src/eslint-plugin.d.ts" } } }';

const PLUGIN_SPECIFIER = "@hailstails/hone/eslint-plugin";

const CHECKS = [
  {
    ruleSet: TOOL_RULE_SET,
    symptom: "S-1",
    check: "C-1",
    ruleId: "hone/S-1-C-1",
    options: [{ maximum: 3 }],
  },
  { ruleSet: TOOL_RULE_SET, symptom: "S-2", check: "C-2", ruleId: "hone/S-2-C-2", options: [] },
];

const ROOT_PROJECTION = checksProjectionText({
  form: { kind: "mjs" },
  pluginImport: PLUGIN_SPECIFIER,
  checks: CHECKS,
  answered: [
    { ruleSet: TOOL_RULE_SET, symptom: "S-1", check: "C-1", file: repoPathOf("src/old.ts") },
  ],
});

const PACKAGE_PROJECTION = checksProjectionText({
  form: { kind: "mjs" },
  pluginImport: PLUGIN_SPECIFIER,
  checks: CHECKS,
  answered: [],
});

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

const ESLINT_PACKAGE = "eslint";

const PLUGIN_USE = `import type { ESLint, Linter } from "${ESLINT_PACKAGE}";
import hone from "${PLUGIN_SPECIFIER}";

export const plugin: ESLint.Plugin = hone;

export const configs: Linter.Config[] = [{ plugins: { hone } }];
`;

const PLUGIN_USED_AS_A_STRING = `import hone from "${PLUGIN_SPECIFIER}";

export const name: string = hone;
`;

describe("the TypeScript a projection's declaration is compiled with", () => {
  it("is TypeScript 6", async () => {
    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({ installRoot: INSTALL_ROOT, installForm: "source" }),
    });

    expect(parse).toMatchObject({
      outcome: "ok",
      value: { syntaxApi: { version: expect.stringMatching(/^6\./) } },
    });
  });
});

describe.each(ESLINT_LINES)(
  "the declaration beside a projection for $folder, where no package can be resolved",
  ({ version }) => {
    it.each(RESOLUTIONS)(
      "compiles on its own under strict with skipLibCheck off, under %s resolution",
      async (resolution) => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "hone.eslint.d.mts",
          resolution,
          form: "typescript",
          texts: [
            {
              path: "hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
          ],
          packages: [],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      },
    );
  },
);

describe.each(ESLINT_LINES)(
  "a typed ESLint config importing a version 2 projection, compiled in memory against the consumer's own node_modules/eslint on $folder, under strict with skipLibCheck off (CD-47: nothing is spawned or written)",
  ({ folder, version }) => {
    describe.each(RESOLUTIONS)("under %s resolution", (resolution) => {
      it("compiles a .ts config for the root projection with the declaration beside it", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "eslint.config.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "eslint.config.ts", text: ROOT_CONFIG },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
            {
              path: "hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
            {
              path: "packages/a/hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });

      it("compiles a .ts config for a package slice over the root projection with the declarations beside them", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "packages/a/eslint.config.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "packages/a/eslint.config.ts", text: PACKAGE_CONFIG },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
            {
              path: "hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
            {
              path: "packages/a/hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });

      it("compiles a checked .mjs config for the root projection with the declaration beside it", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "eslint.config.mjs",
          resolution,
          form: "checked-javascript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "eslint.config.mjs", text: ROOT_CONFIG },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
            {
              path: "hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
            {
              path: "packages/a/hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });

      it("compiles a checked .mjs config for a package slice over the root projection with the declarations beside them", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "packages/a/eslint.config.mjs",
          resolution,
          form: "checked-javascript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "packages/a/eslint.config.mjs", text: PACKAGE_CONFIG },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
            {
              path: "hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
            {
              path: "packages/a/hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });

      it("types the default export as an array of the configs Hone writes, so using it as a string names both ways it is not one", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "misuse.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "misuse.ts", text: MISUSE },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
            {
              path: "hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
            {
              path: "packages/a/hone.eslint.d.mts",
              text: createChecksDeclarationText({
                projectionTypeText: boundary.value.projectionTypeText,
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({
          outcome: "ok",
          value: [
            {
              path: "misuse.ts",
              code: 2322,
              message:
                'Type \'{ name: string; files: string[]; ignores?: string[] | undefined; plugins?: Record<string, object> | undefined; rules: Record<string, "error" | "off" | ["error", ...unknown[]]>; }\' is not assignable to type \'string\'.',
            },
            {
              path: "misuse.ts",
              code: 2322,
              message: "Type 'number' is not assignable to type 'string'.",
            },
          ],
        });
      });

      it("leaves a .ts config importing a projection with no type to import when no declaration is beside it", async () => {
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "eslint.config.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "eslint.config.ts", text: ROOT_CONFIG },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({
          outcome: "ok",
          value: [
            {
              path: "eslint.config.ts",
              code: 7016,
              message:
                "Could not find a declaration file for module './hone.eslint.mjs'. 'hone.eslint.mjs' implicitly has an 'any' type.",
            },
          ],
        });
      });

      it("leaves a checked .mjs config importing a projection typed as the union of the shapes its blocks have when no declaration is beside it", async () => {
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "eslint.config.mjs",
          resolution,
          form: "checked-javascript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "eslint.config.mjs", text: ROOT_CONFIG },
            { path: "hone.eslint.mjs", text: ROOT_PROJECTION },
            { path: "packages/a/hone.eslint.mjs", text: PACKAGE_PROJECTION },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({
          outcome: "ok",
          value: [
            { path: "eslint.config.mjs", code: 2322, message: expect.any(String) },
            { path: "eslint.config.mjs", code: 2322, message: expect.any(String) },
          ],
        });
      });

      it("takes the shipped plugin declaration as ESLint's plugin type, alone and in a flat config", async () => {
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "plugin-use.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "plugin-use.ts", text: PLUGIN_USE },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });

      it("types the shipped plugin's default export as the plugin, not as any", async () => {
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "plugin-misuse.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "plugin-misuse.ts", text: PLUGIN_USED_AS_A_STRING },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({
          outcome: "ok",
          value: [
            {
              path: "plugin-misuse.ts",
              code: 2322,
              message: "Type 'HonePlugin' is not assignable to type 'string'.",
            },
          ],
        });
      });
    });
  },
);

const TS_ROOT_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import hone from "./hone.eslint.js";

export default defineConfig([...hone, { files: ["**/*.ts"], rules: {} }]);
`;

const TS_PACKAGE_CONFIG = `import { defineConfig } from "${CONFIG_API}";
import root from "../../hone.eslint.js";
import slice from "./hone.eslint.js";

export default defineConfig([...root, ...slice, { files: ["**/*.ts"], rules: {} }]);
`;

describe.each(ESLINT_LINES)(
  "a typed ESLint config importing a ts kind projection as ./hone.eslint.js, compiled in memory against the consumer's own node_modules/eslint on $folder, under strict with skipLibCheck off",
  ({ folder, version }) => {
    describe.each(RESOLUTIONS)("under %s resolution", (resolution) => {
      it("compiles a .ts config for the root projection", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");
        const form = { kind: "ts", projectionTypeText: boundary.value.projectionTypeText } as const;

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "eslint.config.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "eslint.config.ts", text: TS_ROOT_CONFIG },
            {
              path: "hone.eslint.ts",
              text: checksProjectionText({
                form,
                pluginImport: PLUGIN_SPECIFIER,
                checks: CHECKS,
                answered: [
                  {
                    ruleSet: TOOL_RULE_SET,
                    symptom: "S-1",
                    check: "C-1",
                    file: repoPathOf("src/old.ts"),
                  },
                ],
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });

      it("compiles a .ts config for a package slice over the root projection", async () => {
        const boundary = await eslintBoundaryFor({ version });
        assert(boundary.outcome === "ok", "the ESLint line has a boundary");
        const plugin = await EMITTED_PLUGIN;
        assert(plugin.outcome === "ok", "the plugin's declarations are emitted");
        const form = { kind: "ts", projectionTypeText: boundary.value.projectionTypeText } as const;

        const diagnostics = await createDefaultConsumerTypesPort({
          installRoot: INSTALL_ROOT,
        }).read({
          entry: "packages/a/eslint.config.ts",
          resolution,
          form: "typescript",
          texts: [
            { path: "package.json", text: CONSUMER_PACKAGE },
            { path: "packages/a/eslint.config.ts", text: TS_PACKAGE_CONFIG },
            {
              path: "hone.eslint.ts",
              text: checksProjectionText({
                form,
                pluginImport: PLUGIN_SPECIFIER,
                checks: CHECKS,
                answered: [],
              }),
            },
            {
              path: "packages/a/hone.eslint.ts",
              text: checksProjectionText({
                form,
                pluginImport: PLUGIN_SPECIFIER,
                checks: CHECKS,
                answered: [],
              }),
            },
          ],
          packages: [
            { kind: "installed", name: "eslint", nodeModules: NODE_MODULES, folder },
            {
              kind: "written",
              name: "@hailstails/hone",
              texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
            },
          ],
        });

        expect(diagnostics).toEqual({ outcome: "ok", value: [] });
      });
    });
  },
);

describe("a ts kind projection imported as ./hone.eslint.js on the TypeScript floor", () => {
  it("compiles a .ts config for the root projection under nodenext resolution with TypeScript 4.8.4", async () => {
    const boundary = await eslintBoundaryFor({ version: "10.15.0" });
    assert(boundary.outcome === "ok", "the ESLint line has a boundary");
    const plugin = await EMITTED_PLUGIN;
    assert(plugin.outcome === "ok", "the plugin's declarations are emitted");
    const floor = typeScriptPeersNamed({
      installRoot: INSTALL_ROOT,
      installForm: "source",
      packageName: "typescript-floor",
    });

    const diagnostics = await createConsumerTypesPort({
      load: () => loadParsePort({ peers: floor }),
    }).read({
      entry: "eslint.config.ts",
      resolution: "nodenext",
      form: "typescript",
      texts: [
        { path: "package.json", text: CONSUMER_PACKAGE },
        {
          path: "eslint.config.ts",
          text: 'import hone from "./hone.eslint.js";\n\nexport default [...hone];\n',
        },
        {
          path: "hone.eslint.ts",
          text: checksProjectionText({
            form: { kind: "ts", projectionTypeText: boundary.value.projectionTypeText },
            pluginImport: PLUGIN_SPECIFIER,
            checks: CHECKS,
            answered: [],
          }),
        },
      ],
      packages: [
        {
          kind: "written",
          name: "@hailstails/hone",
          texts: [{ path: "package.json", text: HONE_PACKAGE }, ...plugin.value.declarations],
        },
      ],
    });

    expect(diagnostics).toEqual({ outcome: "ok", value: [] });
  });
});
