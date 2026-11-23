import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { createImportsRewrittenOf } from "./moved-imports.ts";

const importsRewrittenOf = createImportsRewrittenOf({
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
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
      name: "an import that leaves off the extension",
      text: "export { names } from './helpers/names';\n",
      rewritten: "export { names } from '../console-calls/helpers/names';\n",
    },
    {
      name: "a side-effect import and a literal dynamic import",
      text: 'import "./helpers/names.ts";\nconst later = import("./helpers/names.ts");\n',
      rewritten:
        'import "../console-calls/helpers/names.ts";\nconst later = import("../console-calls/helpers/names.ts");\n',
    },
    {
      name: "an import of a file outside the folder, which Hone did not move",
      text: 'import { shared } from "../../../shared/shared.ts";\n',
      rewritten: 'import { shared } from "../../../shared/shared.ts";\n',
    },
    {
      name: "a package import",
      text: 'import { z } from "zod";\n',
      rewritten: 'import { z } from "zod";\n',
    },
  ])("rewrites only what moved: $name", ({ text, rewritten }) => {
    expect(rewrittenFrom(text)).toEqual({ outcome: "ok", value: rewritten });
  });

  it.each([
    { name: "a computed dynamic import", text: "const module = await import(name);\n" },
    { name: "a require call", text: 'const names = require("./helpers/names.ts");\n' },
    { name: "a path built from import.meta", text: 'new URL("./data.json", import.meta.url);\n' },
    { name: "an import of a folder file it cannot find", text: 'import "./gone.ts";\n' },
  ])("refuses $name, which takes more than rewriting a specifier", ({ text }) => {
    expect(rewrittenFrom(text)).toEqual({ outcome: "failed", error: "beyond-import-specifiers" });
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
