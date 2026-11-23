import { assert, describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { createImportsRewrittenOf } from "./moved-imports.ts";
import { defaultTypeScriptPeers, loadParsePort } from "./toolchain/typescript-toolchain.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../..`,
    installForm: "source",
  }),
});

assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");

const importsRewrittenOf = createImportsRewrittenOf({
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
  parse: loadedParsePort.value,
});

const FOLDER = repoPathOf("acme/mechanisms/eslint/ACME-1");

const DRAFT = repoPathOf("acme/mechanisms/eslint/ACME-1/draft.ts");

const DRAFT_MOVED_TO = repoPathOf("acme/engines/eslint/direct-console/draft-calls/draft.ts");

const MOVED = new Map([
  [DRAFT, DRAFT_MOVED_TO],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/helpers/names.ts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/helpers/names.ts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/index.ts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/index.ts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/sibling.ts"),
    repoPathOf("acme/engines/eslint/direct-console/draft-calls/sibling.ts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/view.tsx"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/view.tsx"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/types.d.ts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/types.d.ts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/legacy.js"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/legacy.js"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/widget.jsx"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/widget.jsx"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/source.ts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/source.ts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/module.mts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/module.mts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/common.cts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/common.cts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/tsx-index/index.tsx"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/tsx-index/index.tsx"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/dts-index/index.d.ts"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/dts-index/index.d.ts"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/js-index/index.js"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/js-index/index.js"),
  ],
  [
    repoPathOf("acme/mechanisms/eslint/ACME-1/forms/jsx-index/index.jsx"),
    repoPathOf("acme/engines/eslint/direct-console/console-calls/forms/jsx-index/index.jsx"),
  ],
]);

const rewrittenFrom = (text: string) =>
  importsRewrittenOf({
    text,
    file: DRAFT,
    movedTo: DRAFT_MOVED_TO,
    folder: FOLDER,
    moved: MOVED,
  });

describe("createImportsRewrittenOf", () => {
  it.each([
    {
      name: "a .tsx file named without its extension",
      text: 'import "./forms/view";\n',
      rewritten: 'import "../console-calls/forms/view";\n',
    },
    {
      name: "a .d.ts file named without its extension",
      text: 'import type { Shape } from "./forms/types";\n',
      rewritten: 'import type { Shape } from "../console-calls/forms/types";\n',
    },
    {
      name: "a .js file named without its extension",
      text: 'import "./forms/legacy";\n',
      rewritten: 'import "../console-calls/forms/legacy";\n',
    },
    {
      name: "a .jsx file named without its extension",
      text: 'import "./forms/widget";\n',
      rewritten: 'import "../console-calls/forms/widget";\n',
    },
    {
      name: "a folder's index.tsx",
      text: 'import "./forms/tsx-index";\n',
      rewritten: 'import "../console-calls/forms/tsx-index";\n',
    },
    {
      name: "a folder's index.d.ts",
      text: 'import "./forms/dts-index";\n',
      rewritten: 'import "../console-calls/forms/dts-index";\n',
    },
    {
      name: "a folder's index.js",
      text: 'import "./forms/js-index";\n',
      rewritten: 'import "../console-calls/forms/js-index";\n',
    },
    {
      name: "a folder's index.jsx",
      text: 'import "./forms/jsx-index";\n',
      rewritten: 'import "../console-calls/forms/jsx-index";\n',
    },
    {
      name: "a .ts file named by the .js it emits",
      text: 'import "./forms/source.js";\n',
      rewritten: 'import "../console-calls/forms/source.js";\n',
    },
    {
      name: "a .tsx file named by the .js it emits",
      text: 'import "./forms/view.js";\n',
      rewritten: 'import "../console-calls/forms/view.js";\n',
    },
    {
      name: "a .mts file named by the .mjs it emits",
      text: 'import "./forms/module.mjs";\n',
      rewritten: 'import "../console-calls/forms/module.mjs";\n',
    },
    {
      name: "a .cts file named by the .cjs it emits",
      text: 'import "./forms/common.cjs";\n',
      rewritten: 'import "../console-calls/forms/common.cjs";\n',
    },
    {
      name: "a .tsx file named by the .jsx it emits",
      text: 'import "./forms/view.jsx";\n',
      rewritten: 'import "../console-calls/forms/view.jsx";\n',
    },
  ])("resolves each name TypeScript resolves: $name", ({ text, rewritten }) => {
    expect(rewrittenFrom(text)).toEqual({ outcome: "ok", value: rewritten });
  });

  it.each([
    {
      name: "a sibling that moves into the same check",
      text: 'import { sibling } from "./sibling.ts";\n',
      rewritten: 'import { sibling } from "./sibling.ts";\n',
    },
    {
      name: "an export of everything and a type-only export",
      text: 'export * from "./helpers/names.ts";\nexport type { Names } from "./helpers/names.ts";\n',
      rewritten:
        'export * from "../console-calls/helpers/names.ts";\nexport type { Names } from "../console-calls/helpers/names.ts";\n',
    },
    {
      name: "a dynamic import written as a template with no substitution",
      text: "const later = import(`./helpers/names.ts`);\n",
      rewritten: "const later = import(`../console-calls/helpers/names.ts`);\n",
    },
    {
      name: "an import of a file Hone moved elsewhere",
      text: 'import { names } from "./helpers/names.ts";\n',
      rewritten: 'import { names } from "../console-calls/helpers/names.ts";\n',
    },
    {
      name: "a type-only import and an export that leaves off the extension",
      text: "import type { Names } from './helpers/names.ts';\nexport { names } from './helpers/names';\n",
      rewritten:
        "import type { Names } from '../console-calls/helpers/names.ts';\nexport { names } from '../console-calls/helpers/names';\n",
    },
    {
      name: "a side-effect import, a literal dynamic import and an import type",
      text: 'import "./helpers/names.ts";\nconst later = import("./helpers/names.ts");\ntype Names = typeof import("./helpers/names.ts");\n',
      rewritten:
        'import "../console-calls/helpers/names.ts";\nconst later = import("../console-calls/helpers/names.ts");\ntype Names = typeof import("../console-calls/helpers/names.ts");\n',
    },
    {
      name: "an import-equals require and a require call",
      text: 'import names = require("./helpers/names.ts");\nconst more = require("./helpers/names.ts");\n',
      rewritten:
        'import names = require("../console-calls/helpers/names.ts");\nconst more = require("../console-calls/helpers/names.ts");\n',
    },
    {
      name: "the folder's index named by the folder itself",
      text: 'import { pieces } from ".";\nimport { more } from "./";\n',
      rewritten:
        'import { pieces } from "../console-calls";\nimport { more } from "../console-calls";\n',
    },
    {
      name: "an import of a file outside the folder, recomputed from where the file moves",
      text: 'import { shared } from "../../../shared/shared.ts";\nimport { up } from "..";\n',
      rewritten:
        'import { shared } from "../../../../shared/shared.ts";\nimport { up } from "../../../../mechanisms/eslint";\n',
    },
    {
      name: "a package import",
      text: 'import { z } from "zod";\n',
      rewritten: 'import { z } from "zod";\n',
    },
    {
      name: "a comment and a string that look like imports",
      text: '// import "./helpers/names.ts";\nconst path = "./helpers/names.ts";\n',
      rewritten: '// import "./helpers/names.ts";\nconst path = "./helpers/names.ts";\n',
    },
  ])("rewrites each relative specifier for where its file moves: $name", ({ text, rewritten }) => {
    expect(rewrittenFrom(text)).toEqual({ outcome: "ok", value: rewritten });
  });

  it.each([
    {
      name: "vi.mock and vi.doMock",
      text: 'vi.mock("./helpers/names.ts");\nvi.doMock("./helpers/names.ts", () => ({}));\n',
      rewritten:
        'vi.mock("../console-calls/helpers/names.ts");\nvi.doMock("../console-calls/helpers/names.ts", () => ({}));\n',
    },
    {
      name: "vi.unmock and vi.importActual",
      text: 'vi.unmock("./helpers/names.ts");\nawait vi.importActual("./helpers/names.ts");\n',
      rewritten:
        'vi.unmock("../console-calls/helpers/names.ts");\nawait vi.importActual("../console-calls/helpers/names.ts");\n',
    },
    {
      name: "vi.importMock and jest.requireActual",
      text: 'await vi.importMock("./helpers/names.ts");\njest.requireActual("./helpers/names.ts");\n',
      rewritten:
        'await vi.importMock("../console-calls/helpers/names.ts");\njest.requireActual("../console-calls/helpers/names.ts");\n',
    },
    {
      name: "jest.mock",
      text: 'jest.mock("./helpers/names.ts");\n',
      rewritten: 'jest.mock("../console-calls/helpers/names.ts");\n',
    },
    {
      name: "vi.mock given the module as an import",
      text: 'vi.mock(import("./helpers/names.ts"));\n',
      rewritten: 'vi.mock(import("../console-calls/helpers/names.ts"));\n',
    },
  ])("rewrites the module a test double names: $name", ({ text, rewritten }) => {
    expect(rewrittenFrom(text)).toEqual({ outcome: "ok", value: rewritten });
  });

  it.each([
    { name: "a computed dynamic import", text: "const module = await import(name);\n", line: 1 },
    { name: "a computed require", text: "\nconst names = require(name);\n", line: 2 },
    { name: "a computed mock path", text: "vi.mock(`./${name}`);\n", line: 1 },
  ])("refuses $name, naming its line", ({ text, line }) => {
    expect(rewrittenFrom(text)).toEqual({
      outcome: "failed",
      error: { reason: "specifier-not-literal", line },
    });
  });

  it("refuses an import of a file of the folder that is not there, naming its line", () => {
    expect(rewrittenFrom('import "./zod.ts";\nimport "./gone.ts";\n')).toEqual({
      outcome: "failed",
      error: { reason: "target-not-moved", line: 1 },
    });
  });

  it("leaves a file that is not a script as it is", () => {
    expect(
      importsRewrittenOf({
        text: '{ "import": "./gone.ts" }\n',
        file: repoPathOf("acme/mechanisms/eslint/ACME-1/data.json"),
        movedTo: repoPathOf("acme/engines/eslint/direct-console/console-calls/data.json"),
        folder: FOLDER,
        moved: MOVED,
      }),
    ).toEqual({ outcome: "ok", value: '{ "import": "./gone.ts" }\n' });
  });
});
