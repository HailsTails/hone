import { describe, expect, it } from "vitest";

import {
  builtModulePath,
  documentAuthorOf,
  externalPackagesOf,
  packagePlanOf,
  piecePathsIn,
} from "./package-plan.ts";

const SOURCE_PATHS = [
  "README.md",
  "ADOPTING.md",
  "MIGRATING.md",
  "CHANGELOG.md",
  "LICENSE",
  "package.json",
  "docs/why-chain-contract.md",
  "docs/adding-a-discipline-or-mechanism.md",
  "docs/extending.md",
  "src/hone.ts",
  "src/tool-command.test.ts",
  "src/application/run/check/run-check.ts",
  "src/infrastructure/engines/typescript-compiler/runner/runner.ts",
  "src/infrastructure/engines/typescript-compiler/runner/runner.test.ts",
  "src/infrastructure/engines/typescript-compiler/runner/piece-type-packages.json",
  "src/infrastructure/engines/typescript-compiler/runner/README.md",
  "src/infrastructure/engines/typescript-compiler/CD-23/piece.json",
  "src/infrastructure/engines/typescript-compiler/CD-23/export-test-sibling.ts",
  "src/infrastructure/engines/eslint/runner/runner.ts",
  "src/infrastructure/engines/eslint/CD-14/piece.json",
  "src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
  "src/infrastructure/engines/eslint/CD-14/README.md",
  "src/infrastructure/engines/eslint/runner/test-fixtures/x/piece.json",
  "rules/README.md",
  "rules/CD-14/README.md",
  "rules/CD-14/discipline.json",
  "methods/README.md",
  "methods/lenses/naming.md",
  "src/infrastructure/content-files/rule-sets/probe-rule-set/mechanisms/audit/PD-1/piece.json",
  "src/composition/walkthrough.integration.test.ts",
];

const AUDIT_PIECE = {
  path: "src/infrastructure/engines/typescript-compiler/CD-23/piece.json",
  text: '{ "version": 1, "discipline": "CD-23", "mechanism": "audit", "clauses": [ { "clause": "export-test-sibling", "settings": { "module": "export-test-sibling.ts" } } ] }',
};

const ESLINT_PIECE = {
  path: "src/infrastructure/engines/eslint/CD-14/piece.json",
  text: '{ "version": 1, "discipline": "CD-14", "mechanism": "eslint", "clauses": [ { "clause": "class-syntax", "settings": { "pluginNamespace": "hone", "pluginModule": "cd14/cd14.eslint-plugin.ts", "rule": "no-class" } }, { "clause": "static-only-class", "settings": { "pluginNamespace": "hone", "pluginModule": "cd14/cd14.eslint-plugin.ts", "rule": "static" } } ] }',
};

describe("piecePathsIn", () => {
  it("lists the shipped pieces' piece.json files, never a runner folder, a test fixture or the probe rule set", () => {
    expect(piecePathsIn({ sourcePaths: SOURCE_PATHS })).toEqual([
      "src/infrastructure/engines/typescript-compiler/CD-23/piece.json",
      "src/infrastructure/engines/eslint/CD-14/piece.json",
    ]);
  });
});

describe("packagePlanOf", () => {
  it("builds the implementation of each named piece and ships its declaration and cases", () => {
    const sourcePaths = [
      "src/infrastructure/engines/eslint/test-switched-off/focused-tests/piece.json",
      "src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json",
      "src/infrastructure/engines/eslint/test-switched-off/focused-tests/test-switches.ts",
      "src/infrastructure/engines/eslint/test-switched-off/skipped-tests/skipped-tests.examples.json",
    ];
    const pieces = [
      {
        path: "src/infrastructure/engines/eslint/test-switched-off/focused-tests/piece.json",
        text: '{"version":2,"settings":{"pluginModule":"test-switches.ts","rule":"focused-tests"}}',
      },
      {
        path: "src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json",
        text: '{"version":2,"settings":{"rule":"skipped-tests"},"implementation":{"symptom":"test-switched-off","check":"focused-tests"}}',
      },
    ];
    expect(piecePathsIn({ sourcePaths })).toEqual([
      "src/infrastructure/engines/eslint/test-switched-off/focused-tests/piece.json",
      "src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json",
    ]);
    expect(packagePlanOf({ sourcePaths, pieces })).toMatchObject({
      outcome: "ok",
      value: {
        entryPoints: expect.arrayContaining([
          "src/infrastructure/engines/eslint/test-switched-off/focused-tests/test-switches.ts",
        ]),
        exported: [
          "src/infrastructure/engines/eslint/test-switched-off/focused-tests/test-switches.js",
        ],
        copied: [
          "src/infrastructure/engines/eslint/test-switched-off/skipped-tests/skipped-tests.examples.json",
        ],
        pieces: [
          {
            path: "src/infrastructure/engines/eslint/test-switched-off/focused-tests/piece.json",
            text: expect.stringContaining('"pluginModule": "test-switches.js"'),
          },
          {
            path: "src/infrastructure/engines/eslint/test-switched-off/skipped-tests/piece.json",
            text: expect.stringContaining('"check": "focused-tests"'),
          },
        ],
      },
    });
  });

  it("builds one shared implementation when either engine selects the check", () => {
    const sourcePaths = [
      "src/infrastructure/engines/eslint/name-off-its-casing/filename-case/piece.json",
      "src/infrastructure/engines/oxlint/name-off-its-casing/filename-case/piece.json",
      "src/infrastructure/engines/protocol/plugin-rules/filename-case.ts",
    ];
    const pieces = [
      {
        path: "src/infrastructure/engines/eslint/name-off-its-casing/filename-case/piece.json",
        text: '{"version":2,"moduleScope":"shared","settings":{"pluginModule":"filename-case.ts"}}',
      },
      {
        path: "src/infrastructure/engines/oxlint/name-off-its-casing/filename-case/piece.json",
        text: '{"version":2,"moduleScope":"shared","settings":{"module":"filename-case.ts"}}',
      },
    ];

    const plan = packagePlanOf({ sourcePaths, pieces });

    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        exported: [
          "src/infrastructure/engines/protocol/plugin-rules/filename-case.js",
          {
            specifier:
              "src/infrastructure/engines/eslint/name-off-its-casing/filename-case/eslint-plugin.js",
            module: "src/infrastructure/engines/protocol/plugin-rules/filename-case.js",
          },
        ],
      },
    });
  });

  it("exports Oxlint plugin modules for adopter configurations", () => {
    const declaration = "src/infrastructure/engines/oxlint/naming/name-format/piece.json";
    const module = "src/infrastructure/engines/oxlint/naming/name-format/plugin.ts";

    expect(
      packagePlanOf({
        sourcePaths: [declaration, module],
        pieces: [
          {
            path: declaration,
            text: '{"version":2,"settings":{"rule":"naming-convention","pluginNamespace":"hone-naming","module":"plugin.ts"}}',
          },
        ],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        entryPoints: expect.arrayContaining([module]),
        exported: ["src/infrastructure/engines/oxlint/naming/name-format/plugin.js"],
      },
    });
  });

  const plan = packagePlanOf({ sourcePaths: SOURCE_PATHS, pieces: [AUDIT_PIECE, ESLINT_PIECE] });

  it("builds the one command, each public entry, each runner and each piece module a shipped piece names, once each", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        entryPoints: [
          "src/hone.ts",
          "src/eslint-plugin.ts",
          "src/rule-set.ts",
          "src/testing.ts",
          "src/walker.ts",
          "src/infrastructure/engines/typescript-compiler/runner/runner.ts",
          "src/infrastructure/engines/eslint/runner/runner.ts",
          "src/infrastructure/engines/typescript-compiler/CD-23/export-test-sibling.ts",
          "src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
        ],
        command: "src/hone.js",
      },
    });
  });

  it.each([
    {
      shape: "a top-level process entry",
      sourcePath: "src/x.process.ts",
      entryPoints: [
        "src/hone.ts",
        "src/eslint-plugin.ts",
        "src/rule-set.ts",
        "src/testing.ts",
        "src/walker.ts",
        "src/x.process.ts",
      ],
    },
    {
      shape: "an engine's runner entry",
      sourcePath: "src/infrastructure/engines/walker/runner/runner.ts",
      entryPoints: [
        "src/hone.ts",
        "src/eslint-plugin.ts",
        "src/rule-set.ts",
        "src/testing.ts",
        "src/walker.ts",
        "src/infrastructure/engines/walker/runner/runner.ts",
      ],
    },
  ])("builds $shape as a process entry", ({ sourcePath, entryPoints }) => {
    const planned = packagePlanOf({ sourcePaths: [sourcePath], pieces: [] });

    expect(planned).toEqual({
      outcome: "ok",
      value: { entryPoints, command: "src/hone.js", copied: [], pieces: [], exported: [] },
    });
  });

  it.each([
    { shape: "a plain top-level module", sourcePath: "src/x.ts" },
    { shape: "a process entry nested below the top of src", sourcePath: "src/a/b.process.ts" },
  ])("leaves $shape out of the entry points", ({ sourcePath }) => {
    const planned = packagePlanOf({ sourcePaths: [sourcePath], pieces: [] });

    expect(planned).toEqual({
      outcome: "ok",
      value: {
        entryPoints: [
          "src/hone.ts",
          "src/eslint-plugin.ts",
          "src/rule-set.ts",
          "src/testing.ts",
          "src/walker.ts",
        ],
        command: "src/hone.js",
        copied: [],
        pieces: [],
        exported: [],
      },
    });
  });

  it("copies the documents, the changelog, mechanism and rule pages, rule data and review methods, and nothing the check never reads or a test owns", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        copied: [
          "README.md",
          "ADOPTING.md",
          "MIGRATING.md",
          "CHANGELOG.md",
          "LICENSE",
          "docs/why-chain-contract.md",
          "docs/adding-a-discipline-or-mechanism.md",
          "docs/extending.md",
          "src/infrastructure/engines/typescript-compiler/runner/README.md",
          "src/infrastructure/engines/eslint/CD-14/README.md",
          "rules/README.md",
          "rules/CD-14/README.md",
          "rules/CD-14/discipline.json",
          "methods/README.md",
          "methods/lenses/naming.md",
        ],
      },
    });
  });

  it("rewrites each shipped piece's module paths to the built .js modules and keeps every other setting", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: {
        pieces: [
          {
            path: "src/infrastructure/engines/typescript-compiler/CD-23/piece.json",
            text: `{
  "version": 1,
  "discipline": "CD-23",
  "mechanism": "audit",
  "clauses": [
    {
      "clause": "export-test-sibling",
      "settings": {
        "module": "export-test-sibling.js"
      }
    }
  ]
}
`,
          },
          {
            path: "src/infrastructure/engines/eslint/CD-14/piece.json",
            text: expect.stringContaining(
              '"pluginModule": "cd14/cd14.eslint-plugin.js",\n        "rule": "no-class"',
            ),
          },
        ],
      },
    });
  });

  it("exports only the built plugin modules of shipped ESLint pieces, the modules a projection imports by package name", () => {
    expect(plan).toMatchObject({
      outcome: "ok",
      value: { exported: ["src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.js"] },
    });
  });

  it("rewrites only the module keys of each clause's settings, leaving a rule option or top-level field of that name alone", () => {
    const piece = {
      path: "src/infrastructure/engines/eslint/CD-14/piece.json",
      text: '{ "version": 1, "module": "top.ts", "clauses": [ { "clause": "class-syntax", "module": "clause.ts", "settings": { "pluginNamespace": "hone", "pluginModule": "cd14/cd14.eslint-plugin.ts", "rule": "no-class", "options": [ { "module": "option.ts" } ] } } ] }',
    };
    expect(packagePlanOf({ sourcePaths: SOURCE_PATHS, pieces: [piece] })).toMatchObject({
      outcome: "ok",
      value: {
        pieces: [
          {
            path: piece.path,
            text: `{
  "version": 1,
  "module": "top.ts",
  "clauses": [
    {
      "clause": "class-syntax",
      "module": "clause.ts",
      "settings": {
        "pluginNamespace": "hone",
        "pluginModule": "cd14/cd14.eslint-plugin.js",
        "rule": "no-class",
        "options": [
          {
            "module": "option.ts"
          }
        ]
      }
    }
  ]
}
`,
          },
        ],
      },
    });
  });

  it("is piece-invalid naming the piece when a piece.json is not JSON", () => {
    expect(
      packagePlanOf({
        sourcePaths: SOURCE_PATHS,
        pieces: [{ path: AUDIT_PIECE.path, text: "{ clauses" }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", path: AUDIT_PIECE.path },
    });
  });

  it("is piece-invalid naming the piece when a piece.json has no clauses", () => {
    expect(
      packagePlanOf({
        sourcePaths: SOURCE_PATHS,
        pieces: [{ path: AUDIT_PIECE.path, text: "{}" }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "piece-invalid", path: AUDIT_PIECE.path },
    });
  });
});

describe("builtModulePath", () => {
  it("swaps a source module's .ts for the built .js", () => {
    expect(builtModulePath({ path: "cd1/cd1.eslint-plugin.ts" })).toBe("cd1/cd1.eslint-plugin.js");
  });

  it("keeps a path that names no source module", () => {
    expect(builtModulePath({ path: "rules/CD-1/discipline.json" })).toBe(
      "rules/CD-1/discipline.json",
    );
  });
});

describe("externalPackagesOf", () => {
  it("keeps each declared package and every subpath of it outside the bundle", () => {
    expect(
      externalPackagesOf({ packages: ["eslint", "@typescript-eslint/parser", "zod"] }),
    ).toEqual([
      "eslint",
      "eslint/*",
      "@typescript-eslint/parser",
      "@typescript-eslint/parser/*",
      "zod",
      "zod/*",
    ]);
  });
});

describe("documentAuthorOf", () => {
  it.each([
    { path: "CHANGELOG.md", author: "release" },
    { path: "README.md", author: "maintainer" },
    { path: "rules/CHANGELOG.md", author: "maintainer" },
  ])("says $path is written by the $author", ({ path, author }) => {
    expect(documentAuthorOf({ path })).toBe(author);
  });
});
