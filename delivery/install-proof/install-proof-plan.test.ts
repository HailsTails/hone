import { describe, expect, it } from "vitest";
import {
  consumerSettingsOf,
  environmentWithoutGit,
  installedVersionOf,
  judgedStep,
  minimumReleaseAgeOf,
  PROOF_CASES,
  packageManagerPinOf,
  packagedConsumerManifest,
  packagedScriptsOf,
  type ProofAction,
  type StepExpectation,
  toolchainPinsOf,
} from "./install-proof-plan.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const packageFiles = import.meta.glob(["../../package.json", "../../pnpm-workspace.yaml"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const FAILING_REPORT = "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling symptom: unit-without-a-running-test, may indicate: tested-where-its-owned\nreadFirst (3)\nunit-without-a-running-test: Unit without a running test. May indicate: gives each unit its test → Tested where it's owned. The breach usually sits in the missing test. Recipe: Companion test file. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#unit-without-a-running-test\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-23#export-test-sibling: read node_modules/@hailstails/hone/rules/CD-23/README.md#spirit\nverdict: fail\n";

const FAILING_REPORT_SHOWN =
  '"findings (1)\\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling symptom: unit-without-a-running-test, may indicate: tested-where-its-owned\\nreadFirst (3)\\nunit-without-a-running-test: Unit without a running test. May indicate: gives each unit its test → Tested where it\'s owned. The breach usually sits in the missing test. Recipe: Companion test file. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#unit-without-a-running-test\\nStart from each rule\'s Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\\nCD-23#export-test-sibling: read node_modules/@hailstails/hone/rules/CD-23/README.md#spirit\\nverdict: fail\\n"';

const FAILING: StepExpectation = { exitCode: 1, output: FAILING_REPORT };

const SILENT: StepExpectation = { exitCode: 0, output: "" };

describe("judgedStep", () => {
  it("passes on the expected exit and exactly the expected output", () => {
    expect(judgedStep({ label: "audit check", expectation: FAILING, run: { outcome: "exited", exitCode: 1, output: FAILING_REPORT } })).toEqual({
      outcome: "ok",
      value: "ok: audit check -> exit 1, output exactly as expected",
    });
  });

  it("fails on an exit mismatch, showing the expected and the captured output", () => {
    expect(judgedStep({ label: "audit check", expectation: SILENT, run: { outcome: "exited", exitCode: 1, output: "" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit check: expected exit 0 and output "", got exit 1 and output ""',
    });
  });

  it.each([
    {
      change: "a finding line",
      output: "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:2:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n",
      shown: '"findings (1)\\nCD-23#export-test-sibling audit src/kept.ts:2:0 missing co-located *.test.ts(x) sibling\\nverdict: fail\\n"',
    },
    {
      change: "a section header",
      output: "findings [1]\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n",
      shown: '"findings [1]\\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\\nverdict: fail\\n"',
    },
    {
      change: "an extra section",
      output: `excluded (1)\nvendor\n${FAILING_REPORT}`,
      shown:
        '"excluded (1)\\nvendor\\nfindings (1)\\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling symptom: unit-without-a-running-test, may indicate: tested-where-its-owned\\nreadFirst (3)\\nunit-without-a-running-test: Unit without a running test. May indicate: gives each unit its test → Tested where it\'s owned. The breach usually sits in the missing test. Recipe: Companion test file. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#unit-without-a-running-test\\nStart from each rule\'s Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\\nCD-23#export-test-sibling: read node_modules/@hailstails/hone/rules/CD-23/README.md#spirit\\nverdict: fail\\n"',
    },
    { change: "only the verdict line", output: "verdict: fail\n", shown: '"verdict: fail\\n"' },
  ])("fails when $change differs, even with the verdict kept", ({ output, shown }) => {
    expect(judgedStep({ label: "audit check", expectation: FAILING, run: { outcome: "exited", exitCode: 1, output } })).toEqual({
      outcome: "failed",
      error: `FAIL: audit check: expected exit 1 and output ${FAILING_REPORT_SHOWN}, got exit 1 and output ${shown}`,
    });
  });

  it("fails an expectation of no output on any output", () => {
    expect(judgedStep({ label: "audit project", expectation: SILENT, run: { outcome: "exited", exitCode: 0, output: "a written\n" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit project: expected exit 0 and output "", got exit 0 and output "a written\\n"',
    });
  });

  it("fails a run that did not exit", () => {
    expect(judgedStep({ label: "audit project", expectation: SILENT, run: { outcome: "not-exited", detail: "spawn ENOENT" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit project: expected exit 0 and output "", but it did not exit: spawn ENOENT',
    });
  });
});

describe("toolchainPinsOf, over this package's own package.json read as a build-time raw module", () => {
  it("pins only typescript, at its floor, for a TypeScript floor consumer", () => {
    expect(toolchainPinsOf({ developmentManifest: packageFiles["../../package.json"], toolchain: "typescript-floor" })).toEqual({
      outcome: "ok",
      value: { typescript: "4.8.4" },
    });
  });

  it("pins every peer at the development version this package is built with for a current consumer", () => {
    expect(toolchainPinsOf({ developmentManifest: packageFiles["../../package.json"], toolchain: "current" })).toEqual({
      outcome: "ok",
      value: { typescript: "6.0.3", eslint: "10.15.0", "@typescript-eslint/parser": "8.73.0", "@typescript-eslint/eslint-plugin": "8.73.0" },
    });
  });

  it("pins TypeScript at its floor and the rest at the development versions, ESLint at the latest 9, for an ESLint 9 consumer", () => {
    expect(toolchainPinsOf({ developmentManifest: packageFiles["../../package.json"], toolchain: "eslint-9" })).toEqual({
      outcome: "ok",
      value: { typescript: "4.8.4", eslint: "9.39.5", "@typescript-eslint/parser": "8.73.0", "@typescript-eslint/eslint-plugin": "8.73.0" },
    });
  });

  it("fails on a manifest that is not JSON", () => {
    expect(toolchainPinsOf({ developmentManifest: "{", toolchain: "typescript-floor" }).outcome).toBe("failed");
  });

  it("fails naming a peer whose floor has no development pin", () => {
    expect(
      toolchainPinsOf({
        developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": {} }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "manifest-invalid", detail: "no development pin typescript-floor for the peer typescript" } });
  });

  it("fails when a floor pin aliases a different package than the peer it stands for", () => {
    expect(
      toolchainPinsOf({
        developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": { "typescript-floor": "npm:typescript-legacy@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "manifest-invalid", detail: "the development pin typescript-floor is npm:typescript-legacy@4.8.4, not an alias of typescript" },
    });
  });

  it("fails when a pinned package is not a declared peer", () => {
    expect(
      toolchainPinsOf({
        developmentManifest: '{ "peerDependencies": {}, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "manifest-invalid", detail: "typescript is not a declared peer" } });
  });
});

const PROJECTION = `import piece0 from "@hailstails/hone/src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
];
`;

const ESLINT_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs written\n" } },
  { kind: "read", path: "disciplines.eslint.mjs", text: PROJECTION },
  { kind: "commit", message: "project" },
  {
    kind: "check",
    expectation: { exitCode: 1, output: "findings (1)\nCD-14#class-syntax eslint src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this, may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted\nreadFirst (3)\nauthored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#authored-class-or-this\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#class-syntax: read node_modules/@hailstails/hone/rules/CD-14/README.md#spirit\nverdict: fail\n" },
  },
];

const AUDIT_ACTIONS: readonly ProofAction[] = [{ kind: "check", expectation: FAILING }];

const ESLINT_MISSING_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: {
      exitCode: 2,
      output:
        "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.39.5 || ^10.15.0; @typescript-eslint/parser found not installed, supported ^8.73.0; @typescript-eslint/eslint-plugin found not installed, supported ^8.73.0: add a supported version of each to the devDependencies of the repository root\n",
    },
  },
];

const WRONG_FIELD_REPORT =
  "typing/wrong-piece-settings.mts(7,37): error TS2344: Type '{ pluginNamespace: string; pluginModule: string; rule: number; }' does not satisfy the constraint 'EslintPieceSettings'.\n  Types of property 'rule' are incompatible.\n    Type 'number' is not assignable to type 'string'.\ntyping/wrong-piece.mts(16,27): error TS2345: Argument of type '{ clause: ClauseAddress; anchor: Anchor; snippet: number; }' is not assignable to parameter of type 'PieceHit'.\n  Types of property 'snippet' are incompatible.\n    Type 'number' is not assignable to type 'string'.\ntyping/wrong-rule-set.mts(3,160): error TS2322: Type '\"lint\"' is not assignable to type '\"review\"'.\n";

const WRONG_FIELDS_REJECTED: ProofAction = { kind: "typecheck", project: "typing/tsconfig.wrong.json", expectation: { exitCode: 2, output: WRONG_FIELD_REPORT } };

const TEAM_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: "tools/disciplines/acme/tsconfig.pieces.json", expectation: SILENT },
  { kind: "typecheck", project: "tools/disciplines/acme/tsconfig.bundler.json", expectation: SILENT },
  { kind: "typecheck", project: "typing/tsconfig.commonjs.json", expectation: SILENT },
  WRONG_FIELDS_REJECTED,
  { kind: "run", script: "tools/disciplines/acme/proof/testing-proof.ts", expectation: SILENT },
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs unchanged\n" } },
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output:
        `editions (1)\nacme/ACME-2#scratch-files audit edition 1 of 2\nfindings (2)\nacme/ACME-1#console-calls eslint src/start-banner.ts:1:0 console.log("web started");\nacme/ACME-2#scratch-files audit notes.scratch.md:1:0 notes.scratch.md\nreadFirst (3)\ndisciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nacme/ACME-1#console-calls: its rule set has no rule page at tools/disciplines/acme/rules/ACME-1/README.md\nacme/ACME-2#scratch-files: its rule set has no rule page at tools/disciplines/acme/rules/ACME-2/README.md\nverdict: fail\n`,
    },
  },
];

const WORKSPACE_SLICE = `import piece0 from "@hailstails/hone/src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.js";

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
      "src/legacy.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const WORKSPACE_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: { exitCode: 0, output: "disciplines.eslint.mjs written\npackages/web/disciplines.eslint.mjs written\n" },
  },
  { kind: "read", path: "packages/web/disciplines.eslint.mjs", text: WORKSPACE_SLICE },
  { kind: "commit", message: "project" },
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output:
        "findings (1)\nCD-14#class-syntax eslint packages/web/src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this, may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted\nexempted (1)\nCD-14#class-syntax eslint packages/web/src/legacy.ts:1:7 export class Legacy {} exempted by file-carve-out\nuncovered (1)\nCD-14#static-only-class\nreadFirst (3)\nauthored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#authored-class-or-this\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#class-syntax: read node_modules/@hailstails/hone/rules/CD-14/README.md#spirit\nverdict: fail\n",
    },
  },
  { kind: "lint", directory: "packages/web", expectation: { exitCode: 1, output: "src/kept.ts:1:8 hone/no-class-authoring\n" } },
];

describe("the proof cases", () => {
  it("install the packed package into an audit-only consumer, an ESLint consumer on each supported major, one missing eslint, a team consumer type-checking the public entries on the TypeScript floor and running its own rule set and its own piece proof on the current version, and a pnpm workspace whose package lints through its own wrapper with its slice, projecting with the package's own import", () => {
    expect(PROOF_CASES).toEqual([
      { consumer: "walker", fixture: "walker", toolchain: "typescript-floor", typeStripping: "disabled", actions: AUDIT_ACTIONS },
      { consumer: "eslint-10", fixture: "eslint", toolchain: "current", typeStripping: "disabled", actions: ESLINT_ACTIONS },
      { consumer: "eslint-9", fixture: "eslint", toolchain: "eslint-9", typeStripping: "disabled", actions: ESLINT_ACTIONS },
      { consumer: "eslint-missing", fixture: "eslint", toolchain: "typescript-floor", typeStripping: "disabled", actions: ESLINT_MISSING_ACTIONS },
      { consumer: "team-floor", fixture: "team", toolchain: "typescript-floor", typeStripping: "disabled", actions: [WRONG_FIELDS_REJECTED] },
      { consumer: "team", fixture: "team", toolchain: "current", typeStripping: "enabled", actions: TEAM_ACTIONS },
      { consumer: "workspace", fixture: "workspace", toolchain: "current", typeStripping: "disabled", actions: WORKSPACE_ACTIONS },
    ]);
  });
  it("name a packaged consumer's scripts after the command and its subcommands", () => {
    expect(packagedScriptsOf({ identity: { name: "Core", packageName: "core-package", command: "core", ownRuleSet: "core", reservedEslintNamespace: "core-package", description: "Core.", repository: "https://github.com/example/core", unrelatedNpmPackage: "core" } })).toEqual({
      check: "core:check",
      project: "core:project",
    });
  });
  it("give a packaged consumer the pnpm release it installs with, scripts calling the command's two subcommands on the repository root, and its development dependencies at the given pins", () => {
    expect(
      packagedConsumerManifest({
        identity: { name: "Core", packageName: "core-package", command: "core", ownRuleSet: "core", reservedEslintNamespace: "core-package", description: "Core.", repository: "https://github.com/example/core", unrelatedNpmPackage: "core" },
        devDependencies: { typescript: "4.8.4" },
        packageManager: "pnpm@10.34.9",
      }),
    ).toBe(
      '{\n  "private": true,\n  "type": "commonjs",\n  "packageManager": "pnpm@10.34.9",\n  "scripts": {\n    "core:check": "core check --repo .",\n    "core:project": "core project --repo ."\n  },\n  "devDependencies": {\n    "typescript": "4.8.4"\n  }\n}\n',
    );
  });
});

describe("the pnpm a consumer installs with", () => {
  it("is the exact pnpm release this package pins", () => {
    expect(packageManagerPinOf({ developmentManifest: packageFiles["../../package.json"] })).toEqual({
      outcome: "ok",
      value: "pnpm@10.34.9+sha512.f49b5a8ea0fdedb44bb3c0c1d6575092a53c2950d95b7ad15df11f17974877a2de3a01c07e934e9b28ce716e51c09a94962c7306d09be2e1e4b18a8c8762fd32",
    });
  });

  it("fails naming a manifest that pins no package manager", () => {
    expect(packageManagerPinOf({ developmentManifest: "{}" })).toEqual({
      outcome: "failed",
      error: { kind: "manifest-invalid", detail: "the package pins no packageManager for a consumer to install with" },
    });
  });

  it("waits the release age this repository's own pnpm settings set", () => {
    expect(minimumReleaseAgeOf({ workspaceSettings: packageFiles["../../pnpm-workspace.yaml"] })).toEqual({ outcome: "ok", value: 4320 });
  });

  it("fails naming pnpm settings that set no release age", () => {
    expect(minimumReleaseAgeOf({ workspaceSettings: "ignoredBuiltDependencies:\n  - esbuild\n" })).toEqual({
      outcome: "failed",
      error: { kind: "manifest-invalid", detail: "pnpm-workspace.yaml sets no minimumReleaseAge for a consumer to install under" },
    });
  });

  it("gives a consumer the release age, and Node options turning type stripping off when its case runs without it", () => {
    expect([
      consumerSettingsOf({ minimumReleaseAge: 4320, typeStripping: "disabled" }),
      consumerSettingsOf({ minimumReleaseAge: 4320, typeStripping: "enabled" }),
    ]).toEqual(["minimum-release-age=4320\nnode-options=--no-experimental-strip-types\n", "minimum-release-age=4320\n"]);
  });
});

describe("installedVersionOf", () => {
  it("reads the version an installed package's manifest names", () => {
    expect(installedVersionOf({ manifestText: '{ "name": "zod", "version": "4.4.3" }' })).toEqual({ outcome: "ok", value: "4.4.3" });
  });

  it("fails naming a manifest that names no version", () => {
    expect([installedVersionOf({ manifestText: '{ "name": "zod" }' }), installedVersionOf({ manifestText: "{" })]).toEqual([
      { outcome: "failed", error: { kind: "manifest-invalid", detail: "its package.json names no version" } },
      { outcome: "failed", error: { kind: "manifest-invalid", detail: expect.any(String) } },
    ]);
  });
});

describe("environmentWithoutGit", () => {
  it("removes every GIT_ variable and keeps the rest", () => {
    expect(environmentWithoutGit({ environment: { GIT_DIR: "/x", GIT_INDEX_FILE: "/y", PATH: "/bin", HOME: "/h" } })).toEqual({
      PATH: "/bin",
      HOME: "/h",
    });
  });
});
