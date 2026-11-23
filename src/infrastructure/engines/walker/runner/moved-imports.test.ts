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
