import { assert, describe, expect, it } from "vitest";

import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createModuleImportsReader } from "./module-imports.ts";

describe("createModuleImportsReader", () => {
  it.each([
    {
      form: "a default and a named value import, by the name the package exports",
      text: 'import loaded, { parse as read } from "zod";\n',
      expected: [{ specifier: "zod", kind: "import", form: "value", names: ["loaded", "parse"] }],
    },
    {
      form: "a type-only namespace import",
      text: 'import type * as zod from "zod";\n',
      expected: [{ specifier: "zod", kind: "import", form: "type-only", names: ["* as zod"] }],
    },
    {
      form: "an import that binds nothing",
      text: 'import "zod/side-effect";\n',
      expected: [{ specifier: "zod/side-effect", kind: "import", form: "value", names: [] }],
    },
    {
      form: "a named re-export, by the name the package exports",
      text: 'export { parse as read } from "zod";\n',
      expected: [{ specifier: "zod", kind: "re-export", form: "value", names: ["parse"] }],
    },
    {
      form: "a type-only re-export of everything",
      text: 'export type * from "zod";\n',
      expected: [{ specifier: "zod", kind: "re-export", form: "type-only", names: ["*"] }],
    },
    {
      form: "a namespace re-export",
      text: 'export * as zod from "zod";\n',
      expected: [{ specifier: "zod", kind: "re-export", form: "value", names: ["* as zod"] }],
    },
    {
      form: "an import-equals declaration",
      text: 'import zod = require("zod");\n',
      expected: [{ specifier: "zod", kind: "import-equals", form: "value", names: ["zod"] }],
    },
    {
      form: "a type-only import-equals declaration",
      text: 'import type zod = require("zod");\n',
      expected: [{ specifier: "zod", kind: "import-equals", form: "type-only", names: ["zod"] }],
    },
    {
      form: "an import type",
      text: 'type Schema = import("zod").ZodType;\n',
      expected: [{ specifier: "zod", kind: "import-type", form: "type-only", names: [] }],
    },
    {
      form: "a dynamic import inside a function",
      text: 'const load = () => import("zod");\n',
      expected: [{ specifier: "zod", kind: "load", form: "dynamic", names: [] }],
    },
    {
      form: "a require call",
      text: 'const zod = require("zod");\n',
      expected: [{ specifier: "zod", kind: "load", form: "dynamic", names: [] }],
    },
    {
      form: "a computed load, by its source text",
      text: "const load = (name: string) => import(`./${name}.ts`);\n",
      expected: [{ specifier: "`./${name}.ts`", kind: "load", form: "dynamic", names: [] }],
    },
    {
      form: "an import inside a module declaration",
      text: 'declare module "outer" {\n  import type { Schema } from "zod";\n}\n',
      expected: [{ specifier: "zod", kind: "import", form: "type-only", names: ["Schema"] }],
    },
    {
      form: "several imports, in source order",
      text: 'import { z } from "zod";\nexport type { Padding } from "left-pad";\n',
      expected: [
        { specifier: "zod", kind: "import", form: "value", names: ["z"] },
        { specifier: "left-pad", kind: "re-export", form: "type-only", names: ["Padding"] },
      ],
    },
    {
      form: "nothing from an export of its own and an ordinary call",
      text: 'export { own };\nconst own = read("zod");\n',
      expected: [],
    },
  ])("reads $form", async ({ text, expected }) => {
    const parse = await loadParsePort({
      peers: defaultTypeScriptPeers({
        installRoot: `${import.meta.dirname}/../..`,
        installForm: "source",
      }),
    });
    assert(parse.outcome === "ok", "the typescript line loads from the development install");
    const readModuleImports = createModuleImportsReader({ parse: parse.value });

    const imports = readModuleImports({ file: "a.ts", text });

    expect(imports).toEqual(expected);
  });
});
