import { describe, expect, it } from "vitest";
import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { type ProjectedPiece, projectionText } from "./projection-text.ts";

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const noTmpFiles = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const eslint = mechanismIdSchema.parse("eslint");
const eslint10 = mechanismIdSchema.parse("eslint-10");

const cd14Piece: ProjectedPiece = {
  pluginNamespace: "hone",
  pluginImport: "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
  clauses: [{ address: classSyntax, ruleId: "hone/no-class-authoring", options: [] }],
};

const probePiece: ProjectedPiece = {
  pluginNamespace: "custom-lint",
  pluginImport: "../team-rules/mechanisms/eslint/PD-1/plugin.ts",
  clauses: [{ address: noTmpFiles, ruleId: "custom-lint/no-tmp-files", options: [] }],
};

const authorisedInB: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture mechanisms/eslint/runner/projection.test.ts#authorisedInB; not historical authorisation" },
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("src/b.ts"),
  reason: "Structural location for the vendor adapter",
};

const carveOutInA: ExceptionRecord = {
  kind: "file-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const authorisedRoute: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture mechanisms/eslint/runner/projection.test.ts#authorisedRoute; not historical authorisation" },
  clause: noTmpFiles,
  mechanism: eslint,
  file: repoPathSchema.parse("route/[id].ts"),
  reason: "Route file named by the framework",
};

const clauseWideNoTmp: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noTmpFiles,
  mechanism: eslint,
  reason: "Probe clause carved out while the probe is retired",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const clauseWideClassSyntax: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  reason: "Class syntax carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const authorisedInBUnderEslint10: ExceptionRecord = { ...authorisedInB, mechanism: eslint10 };

const fullProjection = `import piece0 from "../team-rules/mechanisms/eslint/PD-1/plugin.ts";
import piece1 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/custom-lint",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "custom-lint": piece0 },
    rules: { "custom-lint/no-tmp-files": "error" },
  },
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece1 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/a.ts",
      "src/b.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
  {
    name: "hone-core/file-records/probe/PD-1#no-tmp-files",
    files: [
      "route/\\\\[id\\\\].ts",
    ],
    rules: { "custom-lint/no-tmp-files": "off" },
  },
  {
    name: "hone-core/clause-wide-carve-out/CD-14#class-syntax",
    rules: { "hone/no-class-authoring": "off" },
  },
  {
    name: "hone-core/clause-wide-carve-out/probe/PD-1#no-tmp-files",
    rules: { "custom-lint/no-tmp-files": "off" },
  },
];
`;

const enablingOnlyProjection = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

const enablingWithOptionsProjection = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": ["error",{"max":2}] },
  },
];
`;

const carveOutOnlyProjection = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/a.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const authorisedInBOnlyProjection = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/b.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const sharedFileProjection = `import piece0 from "../team-rules/mechanisms/eslint/PD-1/plugin.ts";
import piece1 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/custom-lint",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "custom-lint": piece0 },
    rules: { "custom-lint/no-tmp-files": "error" },
  },
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece1 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/b.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax, probe/PD-1#no-tmp-files",
    files: [
      "src/a.ts",
    ],
    rules: { "custom-lint/no-tmp-files": "off", "hone/no-class-authoring": "off" },
  },
];
`;

const tmpFilesInA: ExceptionRecord = { ...authorisedRoute, file: repoPathSchema.parse("src/a.ts") };

const carveOutInB: ExceptionRecord = { ...carveOutInA, file: repoPathSchema.parse("src/b.ts") };

describe("projectionText", () => {
  it("generates the whole projection: piece blocks, then one block per set of clauses its files are excepted from, by that set's text, then clause-wide blocks by clause text", () => {
    expect(
      projectionText({
        selectedPieces: [cd14Piece, probePiece],
        records: [
          authorisedInB,
          clauseWideNoTmp,
          carveOutInA,
          authorisedRoute,
          clauseWideClassSyntax,
        ],
      }),
    ).toBe(fullProjection);
  });

  it("generates the same text whatever order the pieces and records arrive in", () => {
    expect(
      projectionText({
        selectedPieces: [probePiece, cd14Piece],
        records: [
          clauseWideClassSyntax,
          authorisedRoute,
          carveOutInA,
          clauseWideNoTmp,
          authorisedInB,
        ],
      }),
    ).toBe(fullProjection);
  });

  it("holds only the enabling block when there are no records", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [] })).toBe(
      enablingOnlyProjection,
    );
  });

  it("enables a rule with options as an error entry followed by those options", () => {
    expect(
      projectionText({
        selectedPieces: [
          { ...cd14Piece, clauses: [{ address: classSyntax, ruleId: "hone/no-class-authoring", options: [{ max: 2 }] }] },
        ],
        records: [],
      }),
    ).toBe(enablingWithOptionsProjection);
  });

  it("emits a file carve-out block whether or not the carve-out is forfeited, since the projection takes no touched set", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [carveOutInA] })).toBe(
      carveOutOnlyProjection,
    );
  });

  it("emits the off block of a record carrying whatever mechanism id the runner is registered under", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [authorisedInBUnderEslint10] })).toBe(
      authorisedInBOnlyProjection,
    );
  });

  it("orders the files of a block by code unit, so src/B.ts precedes src/a.ts", () => {
    expect(
      projectionText({
        selectedPieces: [cd14Piece],
        records: [carveOutInA, { ...authorisedInB, file: repoPathSchema.parse("src/B.ts") }],
      }),
    ).toBe(`import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/B.ts",
      "src/a.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`);
  });

  it("gives a file excepted from several clauses one block turning all their rules off, apart from files excepted from fewer", () => {
    expect(
      projectionText({ selectedPieces: [cd14Piece, probePiece], records: [carveOutInA, authorisedInB, tmpFilesInA] }),
    ).toBe(sharedFileProjection);
  });

  it("groups the same files whatever order their records arrive in", () => {
    expect(
      projectionText({ selectedPieces: [probePiece, cd14Piece], records: [tmpFilesInA, authorisedInB, carveOutInA] }),
    ).toBe(sharedFileProjection);
  });

  it("lists a file once when both an authorised location and a carve-out except it from the same clause", () => {
    expect(projectionText({ selectedPieces: [cd14Piece], records: [authorisedInB, carveOutInB] })).toBe(
      authorisedInBOnlyProjection,
    );
  });
});
