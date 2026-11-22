import { z } from "zod";
import { parsedJson } from "../../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import type { Result } from "../../src/domain/result.ts";
import { TOOL_IDENTITY, type ToolIdentity } from "../../src/domain/rule-set/tool-identity.ts";

export type EntryKind = "folder" | "file";

export type EntryDisposition = "left-out" | "kept";

export type StepExpectation = { readonly exitCode: number; readonly output: string };

export type StepRun =
  | { readonly outcome: "exited"; readonly exitCode: number; readonly output: string }
  | { readonly outcome: "not-exited"; readonly detail: string };

export type ConsumerFixture = "walker" | "eslint" | "team" | "workspace";

export type ProofAction =
  | { readonly kind: "check"; readonly expectation: StepExpectation }
  | { readonly kind: "project"; readonly expectation: StepExpectation }
  | { readonly kind: "commit"; readonly message: string }
  | { readonly kind: "read"; readonly path: string; readonly text: string }
  | { readonly kind: "typecheck"; readonly project: string; readonly expectation: StepExpectation }
  | { readonly kind: "lint"; readonly directory: string; readonly expectation: StepExpectation }
  | { readonly kind: "run"; readonly script: string; readonly expectation: StepExpectation };

export type ProofToolchain = "typescript-floor" | "current" | "eslint-9";

export type TypeStripping = "disabled" | "enabled";

export type CommandScript = "check" | "project";

export type ProofCase = {
  readonly consumer: string;
  readonly fixture: ConsumerFixture;
  readonly toolchain: ProofToolchain;
  readonly typeStripping: TypeStripping;
  readonly actions: readonly ProofAction[];
};

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

const ESLINT_PROJECTION = `import piece0 from "${TOOL_IDENTITY.packageName}/src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "${TOOL_IDENTITY.reservedEslintNamespace}/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
];
`;

const ESLINT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs written\n" } },
  { kind: "read", path: "disciplines.eslint.mjs", text: ESLINT_PROJECTION },
  { kind: "commit", message: "project" },
  {
    kind: "check",
    expectation: { exitCode: 1, output: "findings (1)\nCD-14#class-syntax eslint src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this, may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted\nreadFirst (3)\nauthored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#authored-class-or-this\nStart from the Spirit of each rule its symptom may indicate. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#class-syntax: read node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/class-keyword.md#fix\nverdict: fail\n" },
  },
];

const AUDIT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  {
    kind: "check",
    expectation: {
      exitCode: 1,
      output: "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling symptom: unit-without-a-running-test, may indicate: tested-where-its-owned\nreadFirst (3)\nunit-without-a-running-test: Unit without a running test. May indicate: gives each unit its test → Tested where it's owned. The breach usually sits in the missing test. Recipe: Companion test file. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#unit-without-a-running-test\nStart from the Spirit of each rule its symptom may indicate. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-23#export-test-sibling: read node_modules/@hailstails/hone/rules/typescript/symptoms/unit-without-a-running-test/companion-test-file.md#fix\nverdict: fail\n",
    },
  },
];

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

const WORKSPACE_SLICE = `import piece0 from "${TOOL_IDENTITY.packageName}/src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.js";

export default [
  {
    name: "${TOOL_IDENTITY.reservedEslintNamespace}/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "${TOOL_IDENTITY.reservedEslintNamespace}/file-records/CD-14#class-syntax",
    files: [
      "src/legacy.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const WORKSPACE_REPORT = `findings (1)
CD-14#class-syntax eslint packages/web/src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this, may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
exempted (1)
CD-14#class-syntax eslint packages/web/src/legacy.ts:1:7 export class Legacy {} exempted by file-carve-out
uncovered (1)
CD-14#static-only-class
readFirst (3)
authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#authored-class-or-this
Start from the Spirit of each rule its symptom may indicate. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.
CD-14#class-syntax: read node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/class-keyword.md#fix
verdict: fail
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
      output: WORKSPACE_REPORT,
    },
  },
  { kind: "lint", directory: "packages/web", expectation: { exitCode: 1, output: "src/kept.ts:1:8 hone/no-class-authoring\n" } },
];

const SILENT_SUCCESS: StepExpectation = { exitCode: 0, output: "" };

const WRONG_FIELD_TYPES_REJECTED: ProofAction = {
  kind: "typecheck",
  project: "typing/tsconfig.wrong.json",
  expectation: {
    exitCode: 2,
    output:
      "typing/wrong-piece-settings.mts(7,37): error TS2344: Type '{ pluginNamespace: string; pluginModule: string; rule: number; }' does not satisfy the constraint 'EslintPieceSettings'.\n  Types of property 'rule' are incompatible.\n    Type 'number' is not assignable to type 'string'.\ntyping/wrong-piece.mts(16,27): error TS2345: Argument of type '{ clause: ClauseAddress; anchor: Anchor; snippet: number; }' is not assignable to parameter of type 'PieceHit'.\n  Types of property 'snippet' are incompatible.\n    Type 'number' is not assignable to type 'string'.\ntyping/wrong-rule-set.mts(3,160): error TS2322: Type '\"lint\"' is not assignable to type '\"review\"'.\n",
  },
};

const TEAM_RULE_SET = "tools/disciplines/acme";

const TEAM_FINDINGS_REPORT = `editions (1)
acme/ACME-2#scratch-files audit edition 1 of 2
findings (2)
acme/ACME-1#console-calls eslint src/start-banner.ts:1:0 console.log("web started");
acme/ACME-2#scratch-files audit notes.scratch.md:1:0 notes.scratch.md
readFirst (3)
disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.
acme/ACME-1#console-calls: its rule set has no rule page at tools/disciplines/acme/rules/ACME-1/README.md
acme/ACME-2#scratch-files: its rule set has no rule page at tools/disciplines/acme/rules/ACME-2/README.md
verdict: fail
`;

const TEAM_FLOOR_ACTIONS: readonly ProofAction[] = [WRONG_FIELD_TYPES_REJECTED];

const TEAM_ACTIONS: readonly ProofAction[] = [
  { kind: "typecheck", project: `${TEAM_RULE_SET}/tsconfig.pieces.json`, expectation: SILENT_SUCCESS },
  { kind: "typecheck", project: `${TEAM_RULE_SET}/tsconfig.bundler.json`, expectation: SILENT_SUCCESS },
  { kind: "typecheck", project: "typing/tsconfig.commonjs.json", expectation: SILENT_SUCCESS },
  WRONG_FIELD_TYPES_REJECTED,
  { kind: "run", script: `${TEAM_RULE_SET}/proof/testing-proof.ts`, expectation: SILENT_SUCCESS },
  { kind: "project", expectation: { exitCode: 0, output: "disciplines.eslint.mjs unchanged\n" } },
  { kind: "check", expectation: { exitCode: 1, output: TEAM_FINDINGS_REPORT } },
];

export const PROOF_CASES: readonly ProofCase[] = [
  { consumer: "walker", fixture: "walker", toolchain: "typescript-floor", typeStripping: "disabled", actions: AUDIT_CONSUMER_ACTIONS },
  { consumer: "eslint-10", fixture: "eslint", toolchain: "current", typeStripping: "disabled", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-9", fixture: "eslint", toolchain: "eslint-9", typeStripping: "disabled", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-missing", fixture: "eslint", toolchain: "typescript-floor", typeStripping: "disabled", actions: ESLINT_MISSING_ACTIONS },
  { consumer: "team-floor", fixture: "team", toolchain: "typescript-floor", typeStripping: "disabled", actions: TEAM_FLOOR_ACTIONS },
  { consumer: "team", fixture: "team", toolchain: "current", typeStripping: "enabled", actions: TEAM_ACTIONS },
  { consumer: "workspace", fixture: "workspace", toolchain: "current", typeStripping: "disabled", actions: WORKSPACE_ACTIONS },
];

export const packagedScriptsOf = (request: { readonly identity: ToolIdentity }): Readonly<Record<CommandScript, string>> => ({
  check: `${request.identity.command}:check`,
  project: `${request.identity.command}:project`,
});

const TYPE_STRIPPING_OFF = "node-options=--no-experimental-strip-types\n";

export const consumerSettingsOf = (request: {
  readonly minimumReleaseAge: number;
  readonly typeStripping: TypeStripping;
}): string =>
  `minimum-release-age=${request.minimumReleaseAge}\n${request.typeStripping === "disabled" ? TYPE_STRIPPING_OFF : ""}`;

export const packagedConsumerManifest = (request: {
  readonly identity: ToolIdentity;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly packageManager: string;
}): string =>
  `${JSON.stringify(
    {
      private: true,
      type: "commonjs",
      packageManager: request.packageManager,
      scripts: {
        [packagedScriptsOf(request).check]: `${request.identity.command} check --repo .`,
        [packagedScriptsOf(request).project]: `${request.identity.command} project --repo .`,
      },
      devDependencies: request.devDependencies,
    },
    null,
    2,
  )}\n`;

export const judgedStep = (request: {
  readonly label: string;
  readonly expectation: StepExpectation;
  readonly run: StepRun;
}): Result<string, string> => {
  const expected = `expected exit ${request.expectation.exitCode} and output ${JSON.stringify(request.expectation.output)}`;
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: ${expected}, but it did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === request.expectation.exitCode && request.run.output === request.expectation.output
    ? { outcome: "ok", value: `ok: ${request.label} -> exit ${request.run.exitCode}, output exactly as expected` }
    : {
        outcome: "failed",
        error: `FAIL: ${request.label}: ${expected}, got exit ${request.run.exitCode} and output ${JSON.stringify(request.run.output)}`,
      };
};
const toolchainManifestSchema = z.object({
  peerDependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()),
});

type ToolchainManifest = z.output<typeof toolchainManifestSchema>;

type FloorPins = Readonly<Record<string, string>>;

const TYPESCRIPT_FLOOR: FloorPins = { typescript: "typescript-floor" };

const CURRENT: FloorPins = {
  typescript: "typescript",
  eslint: "eslint",
  "@typescript-eslint/parser": "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin": "@typescript-eslint/eslint-plugin",
};

const FLOOR_PINS: Readonly<Record<ProofToolchain, FloorPins>> = {
  "typescript-floor": TYPESCRIPT_FLOOR,
  current: CURRENT,
  "eslint-9": { ...CURRENT, ...TYPESCRIPT_FLOOR, eslint: "eslint-9" },
};

const manifestInvalid = (request: { readonly detail: string }): Result<never, ManifestFailure> => ({
  outcome: "failed",
  error: { kind: "manifest-invalid", detail: request.detail },
});

const floorVersion = (request: {
  readonly manifest: ToolchainManifest;
  readonly peer: string;
  readonly pinName: string;
}): Result<string, ManifestFailure> => {
  const pin = request.manifest.devDependencies[request.pinName];
  if (pin === undefined) {
    return manifestInvalid({ detail: `no development pin ${request.pinName} for the peer ${request.peer}` });
  }
  const aliasPrefix = `npm:${request.peer}@`;
  const aliasedPin = request.pinName === request.peer ? `${aliasPrefix}${pin}` : pin;
  if (!aliasedPin.startsWith(aliasPrefix)) {
    return manifestInvalid({ detail: `the development pin ${request.pinName} is ${pin}, not an alias of ${request.peer}` });
  }
  return request.peer in request.manifest.peerDependencies
    ? { outcome: "ok", value: aliasedPin.slice(aliasPrefix.length) }
    : manifestInvalid({ detail: `${request.peer} is not a declared peer` });
};

const floorVersions = (request: {
  readonly manifest: ToolchainManifest;
  readonly toolchain: ProofToolchain;
}): Result<FloorPins, ManifestFailure> =>
  Object.entries(FLOOR_PINS[request.toolchain]).reduce<Result<FloorPins, ManifestFailure>>((sofar, [peer, pinName]) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const version = floorVersion({ manifest: request.manifest, peer, pinName });
    return version.outcome === "failed" ? version : { outcome: "ok", value: { ...sofar.value, [peer]: version.value } };
  }, { outcome: "ok", value: {} });

export const toolchainPinsOf = (request: {
  readonly developmentManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<FloorPins, ManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return manifestInvalid({ detail: parsed.error });
  }
  const manifest = toolchainManifestSchema.safeParse(parsed.value);
  return manifest.success
    ? floorVersions({ manifest: manifest.data, toolchain: request.toolchain })
    : manifestInvalid({ detail: manifest.error.message });
};

const packageManagerPinSchema = z.object({ packageManager: z.string().min(1) });

export const packageManagerPinOf = (request: { readonly developmentManifest: string }): Result<string, ManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return manifestInvalid({ detail: parsed.error });
  }
  const manifest = packageManagerPinSchema.safeParse(parsed.value);
  return manifest.success
    ? { outcome: "ok", value: manifest.data.packageManager }
    : manifestInvalid({ detail: "the package pins no packageManager for a consumer to install with" });
};

const MINIMUM_RELEASE_AGE_SETTING = /^minimumReleaseAge: (\d+)$/m;

export const minimumReleaseAgeOf = (request: { readonly workspaceSettings: string }): Result<number, ManifestFailure> => {
  const setting = MINIMUM_RELEASE_AGE_SETTING.exec(request.workspaceSettings);
  return setting === null
    ? manifestInvalid({ detail: "pnpm-workspace.yaml sets no minimumReleaseAge for a consumer to install under" })
    : { outcome: "ok", value: Number(setting[1]) };
};

const installedManifestSchema = z.object({ version: z.string().min(1) });

export const installedVersionOf = (request: { readonly manifestText: string }): Result<string, ManifestFailure> => {
  const parsed = parsedJson({ text: request.manifestText });
  if (parsed.outcome === "failed") {
    return manifestInvalid({ detail: parsed.error });
  }
  const manifest = installedManifestSchema.safeParse(parsed.value);
  return manifest.success ? { outcome: "ok", value: manifest.data.version } : manifestInvalid({ detail: "its package.json names no version" });
};

export const environmentWithoutGit = (request: {
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Readonly<Record<string, string | undefined>> =>
  Object.fromEntries(Object.entries(request.environment).filter(([name]) => !name.startsWith("GIT_")));
