import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { projectionImportingOf, rewrittenConfigOf } from "./config-import-rewrite.ts";

const VERSION_ONE = repoPathSchema.parse("disciplines.eslint.mjs");

const VERSION_TWO = repoPathSchema.parse("hone.eslint.mjs");

const PAIR = { versionOneProjection: VERSION_ONE, versionTwoProjection: VERSION_TWO };

describe("rewrittenConfigOf rewriting the one import of the version 1 projection", () => {
  it.each([
    {
      name: "a config at the repository root",
      file: "eslint.config.mjs",
      text: 'import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n',
      rewritten: 'import projection from "./hone.eslint.mjs";\nexport default [...projection];\n',
    },
    {
      name: "a config in a folder, single-quoted",
      file: "web/eslint.config.mjs",
      text: "import base from '../disciplines.eslint.mjs';\nexport default [...base, { files: ['**/*.ts'] }];\n",
      rewritten: "import base from '../hone.eslint.mjs';\nexport default [...base, { files: ['**/*.ts'] }];\n",
    },
    {
      name: "a config two folders deep, among other imports",
      file: "packages/web/eslint.config.mjs",
      text: 'import js from "@eslint/js";\nimport rules from "../../disciplines.eslint.mjs";\nexport default [js.configs.recommended, ...rules];\n',
      rewritten: 'import js from "@eslint/js";\nimport rules from "../../hone.eslint.mjs";\nexport default [js.configs.recommended, ...rules];\n',
    },
    {
      name: "a config whose import spans several lines",
      file: "eslint.config.mjs",
      text: 'import projection\n  from "./disciplines.eslint.mjs";\nexport default [...projection];\n',
      rewritten: 'import projection\n  from "./hone.eslint.mjs";\nexport default [...projection];\n',
    },
  ])("rewrites only the specifier in $name",({ file, text, rewritten }) => {
    expect(
      rewrittenConfigOf({ file: repoPathSchema.parse(file), text, pairs: [PAIR] }),
    ).toEqual({ outcome: "ok", value: rewritten });
  });
});

describe("rewrittenConfigOf refusing what it cannot rewrite safely", () => {
  it("refuses a config with no import of the version 1 projection, naming the file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import js from "@eslint/js";\nexport default [js.configs.recommended];\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config whose only import of that name resolves to another folder's file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import other from "./web/disciplines.eslint.mjs";\nexport default [...other];\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config that imports the version 1 projection twice, naming the file and the count", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import first from "./disciplines.eslint.mjs";\nimport second from "./disciplines.eslint.mjs";\nexport default [...first, ...second];\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "several-projection-imports", file: "eslint.config.mjs", count: 2 } });
  });

  it.each([
    { name: "an import commented out with a line comment", text: '// import projection from "./disciplines.eslint.mjs";\nexport default [];\n' },
    { name: "an import commented out with a block comment", text: '/* import projection from "./disciplines.eslint.mjs"; */\nexport default [];\n' },
    { name: "an import with a default and named bindings", text: 'import projection, { extra } from "./disciplines.eslint.mjs";\nexport default [...projection];\n' },
    { name: "a namespace import", text: 'import * as projection from "./disciplines.eslint.mjs";\nexport default [...projection.default];\n' },
    { name: "a type import", text: 'import type projection from "./disciplines.eslint.mjs";\nexport default [];\n' },
  ])("refuses a config whose only mention of the projection is $name, naming the file", ({ text }) => {
    expect(
      rewrittenConfigOf({ file: repoPathSchema.parse("eslint.config.mjs"), text, pairs: [PAIR] }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config whose import follows a string holding two slashes on its line, as the comment blanking hides it", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'const docs = "https://example.test"; import projection from "./disciplines.eslint.mjs";\nexport default [...projection];\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses a config whose second import of the projection a string holding two slashes hides, never rewriting only the first", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import first from "./disciplines.eslint.mjs";\nconst docs = "https://example.test"; import second from "./disciplines.eslint.mjs";\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } });
  });

  it("refuses a config that names the projection in a string beside its import, naming the file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import projection from "./disciplines.eslint.mjs";\nconst named = "disciplines.eslint.mjs";\nexport default [...projection];\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } });
  });

  it("refuses a config that names the projection anywhere else, naming the file", () => {
    expect(
      rewrittenConfigOf({
        file: repoPathSchema.parse("eslint.config.mjs"),
        text: 'import projection from "./disciplines.eslint.mjs";\nexport default [...projection]; // see disciplines.eslint.mjs\n',
        pairs: [PAIR]
      }),
    ).toEqual({ outcome: "failed", error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" } });
  });
});

describe("rewrittenConfigOf over a config that imports several version 1 projections of the same file name", () => {
  const PACKAGE_PAIR = { versionOneProjection: repoPathSchema.parse("packages/a/disciplines.eslint.mjs"), versionTwoProjection: repoPathSchema.parse("packages/a/hone.eslint.mjs") };

  const TEXT = 'import root from "./disciplines.eslint.mjs";\nimport slice from "./packages/a/disciplines.eslint.mjs";\nexport default [...slice, ...root];\n';

  it("renames every import to the version 2 projection of its own pair", () => {
    expect(rewrittenConfigOf({ file: repoPathSchema.parse("eslint.config.mjs"), text: TEXT, pairs: [PAIR, PACKAGE_PAIR] })).toEqual({
      outcome: "ok",
      value: 'import root from "./hone.eslint.mjs";\nimport slice from "./packages/a/hone.eslint.mjs";\nexport default [...slice, ...root];\n',
    });
  });

  it("refuses a config that imports a projection of that file name no pair holds, naming the file", () => {
    expect(rewrittenConfigOf({ file: repoPathSchema.parse("eslint.config.mjs"), text: TEXT, pairs: [PAIR] })).toEqual({
      outcome: "failed",
      error: { kind: "projection-named-elsewhere", file: "eslint.config.mjs" },
    });
  });

  it("refuses a config that imports none of a pair's projection, naming that projection", () => {
    expect(rewrittenConfigOf({ file: repoPathSchema.parse("eslint.config.mjs"), text: TEXT, pairs: [PAIR, { ...PACKAGE_PAIR, versionOneProjection: repoPathSchema.parse("other/disciplines.eslint.mjs") }] })).toEqual({
      outcome: "failed",
      error: { kind: "no-projection-import", file: "eslint.config.mjs", projection: "other/disciplines.eslint.mjs" },
    });
  });
});

describe("projectionImportingOf", () => {
  it.each([
    { name: "a static default import of the projection", text: 'import projection from "./disciplines.eslint.mjs";\n', importing: "imports" },
    { name: "a dynamic import of the projection", text: 'const projection = await import("./disciplines.eslint.mjs");\n', importing: "does-not-import" },
    { name: "an import of a file of another name", text: 'import other from "./other.mjs";\n', importing: "does-not-import" },
  ] as const)("reads $name as $importing", ({ text, importing }) => {
    expect(projectionImportingOf({ file: repoPathSchema.parse("eslint.config.mjs"), text, versionOneProjection: VERSION_ONE })).toBe(importing);
  });
});
