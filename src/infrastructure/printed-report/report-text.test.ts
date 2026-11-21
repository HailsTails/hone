import { describe, expect, it } from "vitest";
import type { VersionOneWhyChain } from "../discipline-exceptions-folder/version-one-why-chain.ts";
import type { ExceptionRecord } from "../discipline-exceptions-folder/exception-records.ts";
import type { Finding } from "../command-line/governance.ts";
import type { ScriptOptionCause } from "../engines/protocol/runner-module/runner-result-schema.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { editionSchema } from "../content-files/edition.ts";
import { mechanismIdSchema } from "../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { reportOutputSchema } from "../hone-config-file/report-output.ts";
import type { CheckReport, ClauseReading, PartialAssessment, ProjectionProblem, Unmeasured } from "../../domain/report/check-report.ts";
import type { Case, Principle, Recipe, RecordKind, Rule, Symptom } from "../../domain/language-layer/symptom-catalogue.ts";
import { renderGuidedReportText, renderReportText } from "./report-text.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "./symptoms/symptom-notes.ts";

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

const RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_RECORDS_FILE = repoPathSchema.parse("discipline-exceptions/file-carve-outs/pd-1.json");

const noClass = clauseAddressSchema.parse("CD-14#no-class-syntax");
const probeNoTmp = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const fileA = repoPathSchema.parse("src/a.ts");
const packageJson = repoPathSchema.parse("package.json");
const suppressions = repoPathSchema.parse("eslint-suppressions.json");
const audit = mechanismIdSchema.parse("audit");
const eslint = mechanismIdSchema.parse("eslint");
const SLICE = repoPathSchema.parse("packages/a/disciplines.eslint.mjs");
const PROJECT_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

const PRUNE_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop --base-revision origin/main";

const finding: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: audit,
};

const located: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/verdict/report-text.test.ts#located; not historical authorisation" },
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
};

const carved: ExceptionRecord = {
  kind: "file-carve-out",
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the parser adapter is unpaid debt",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const carvedEverywhere: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noClass,
  mechanism: audit,
  reason: "the whole clause is unpaid debt",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const emptyReport: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

describe("renderReportText entry lines", () => {
  it("renders a finding as clause, mechanism, file:line:column and snippet", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, findings: [finding] } }),
    ).toContain("\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\n");
  });

  it("renders the excluded paths first, one per line, before any finding", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated"), repoPathSchema.parse("src/legacy.ts")], findings: [finding] },
      }),
    ).toBe(
      "excluded (2)\ngenerated\nsrc/legacy.ts\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("renders an exempted finding followed by the kind of each crediting record", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [carved, carvedEverywhere] }] },
      }),
    ).toContain(
      "\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out exempted by clause-wide-carve-out\n",
    );
  });

  it("renders an uncovered clause as its address text", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, uncovered: [probeNoTmp] } }),
    ).toContain("\nprobe/PD-1#no-tmp-files\n");
  });

  it("renders a stale authorised location as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, stale: [located] } }),
    ).toContain("\nCD-14#no-class-syntax audit authorised-location src/a.ts\n");
  });

  it("renders a stale clause-wide carve-out with * for its file", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, stale: [carvedEverywhere] } }),
    ).toContain("\nCD-14#no-class-syntax audit clause-wide-carve-out *\n");
  });

  it("renders a forfeited file carve-out as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, forfeited: [carved] } }),
    ).toContain("\nCD-14#no-class-syntax audit file-carve-out src/a.ts\n");
  });

  it("renders a doubly-held entry as clause, mechanism, doubly-held and file", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax audit doubly-held src/a.ts\n");
  });

  it("renders an unrecorded ignore as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint ignore src/a.ts\n");
  });

  it("renders an unrecorded config override as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            { kind: "config-override", clause: noClass, file: fileA, mechanism: eslint },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint config-override src/a.ts\n");
  });

  it("renders an unrecorded suppression entry with its location", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "suppression-entry",
              clause: noClass,
              file: fileA,
              location: suppressions,
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint suppression-entry src/a.ts eslint-suppressions.json\n");
  });

  it("renders a finding whose snippet holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          findings: [{ ...finding, snippet: "class A {\n}\r\nclass B {}" }],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax audit src/a.ts:3:5 class A {\n}\r\nclass B {}
`);
  });

  it("renders an unrecorded inline disable whose text holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 7,
              text: "/* eslint-disable\nno-class */\r",
              reach: "one-clause",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax eslint inline-disable src/a.ts:7 /* eslint-disable\nno-class */\r
`);
  });

  it("renders a command-line option whose script and option hold line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "command-line-option",
              clause: noClass,
              location: packageJson,
              script: "lint\r\nfix",
              option: "--rule\nno-class:off",
              cause: { kind: "weakens-run" },
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax eslint command-line-option package.json lint\r\nfix --rule\nno-class:off weakens the script's whole run, so no record can cover it: remove it from the script
`);
  });

  it("renders an invalid record whose detail holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              place: { layout: "single-file", file: RECORDS_FILE, index: 4 },
              problem: { kind: "why-chain-refused", detail: "why 2\nis empty\r" },
            },
          ],
        },
      }),
    ).toContain(String.raw`
exceptions[4] why-chain-refused why 2\nis empty\r
`);
  });

  it("renders an unrecorded inline disable with its line and text", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 7,
              text: "// eslint-disable-line no-class",
              reach: "one-clause",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint inline-disable src/a.ts:7 // eslint-disable-line no-class\n");
  });

  it("renders an unrecorded inline disable that names no rule with the cheap fix after its text", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 1,
              text: "/* eslint-disable */",
              reach: "every-selected-clause",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(
      "\nCD-14#no-class-syntax eslint inline-disable src/a.ts:1 /* eslint-disable */ names no rule and escapes every selected clause: naming the rule is the cheap fix\n",
    );
  });

  it("renders an unrecorded inline rule config with its line and text", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-rule-config",
              clause: noClass,
              file: fileA,
              line: 2,
              text: "/* eslint no-class: off */",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint inline-rule-config src/a.ts:2 /* eslint no-class: off */\n");
  });

  it("renders an unrecorded command-line option as its location, script and option", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "command-line-option",
              clause: noClass,
              location: packageJson,
              script: "lint",
              option: "--rule no-class:off",
              cause: { kind: "weakens-run" },
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint command-line-option package.json lint --rule no-class:off weakens the script's whole run, so no record can cover it: remove it from the script\n");
  });

  it.each<{ readonly option: string; readonly cause: ScriptOptionCause; readonly note: string }>([
    {
      option: "-c eslint.config.mjs",
      cause: { kind: "after-another-command", command: "eslint", invocation: "TIMING=1 eslint -c eslint.config.mjs ." },
      note: ': eslint is not the first command of its script, so Hone cannot tell what the option does to the files under check; give eslint a script of its own, such as "TIMING=1 eslint -c eslint.config.mjs ."',
    },
    {
      option: "--ignore-pattern dist",
      cause: { kind: "wrapped", command: "eslint", wrapper: "-y" },
      note: ': "-y" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint',
    },
    {
      option: "eslint --rule 'no-class: off",
      cause: { kind: "unreadable", command: "eslint" },
      note: ": a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check; pair every quote in the script",
    },
  ])("renders $option with the reason $cause.kind gives and its way out", ({ option, cause, note }) => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unrecorded: [
            { kind: "command-line-option", clause: noClass, location: packageJson, script: "lint", option, cause, mechanism: eslint },
          ],
        },
      }),
    ).toContain(`
CD-14#no-class-syntax eslint command-line-option package.json lint ${option}${note}
`);
  });

  it("renders an invalid record that carries a detail as its index, problem kind and detail", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              place: { layout: "single-file", file: RECORDS_FILE, index: 2 },
              problem: { kind: "clause-unparseable", detail: "is not a clause address" },
            },
          ],
        },
      }),
    ).toContain("\nexceptions[2] clause-unparseable is not a clause address\n");
  });

  it("renders a refused why chain as its index, problem kind and detail", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              place: { layout: "single-file", file: RECORDS_FILE, index: 0 },
              problem: { kind: "why-chain-refused", detail: "`whyChain.owner` is required" },
            },
          ],
        },
      }),
    ).toContain("\nexceptions[0] why-chain-refused `whyChain.owner` is required\n");
  });

  it("renders a clause-not-selected invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { place: { layout: "single-file", file: RECORDS_FILE, index: 3 }, problem: { kind: "clause-not-selected", clause: probeNoTmp } },
          ],
        },
      }),
    ).toContain("\nexceptions[3] clause-not-selected probe/PD-1#no-tmp-files\n");
  });

  it("renders a file-not-repo-path invalid record with the refused file", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { place: { layout: "single-file", file: RECORDS_FILE, index: 3 }, problem: { kind: "file-not-repo-path", file: "/abs/a.ts" } },
          ],
        },
      }),
    ).toContain("\nexceptions[3] file-not-repo-path /abs/a.ts\n");
  });

  it("renders an invalid record of the split layout with the file that holds it and its index there", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { place: { layout: "split", file: SPLIT_RECORDS_FILE, index: 3 }, problem: { kind: "clause-not-selected", clause: probeNoTmp } },
          ],
        },
      }),
    ).toContain("\ndiscipline-exceptions/file-carve-outs/pd-1.json exceptions[3] clause-not-selected probe/PD-1#no-tmp-files\n");
  });

  it("renders a duplicate of the split layout with the file and index of the record it duplicates", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              place: { layout: "split", file: SPLIT_RECORDS_FILE, index: 3 },
              problem: { kind: "duplicate", of: { layout: "split", file: SPLIT_RECORDS_FILE, index: 1 } },
            },
          ],
        },
      }),
    ).toContain("\ndiscipline-exceptions/file-carve-outs/pd-1.json exceptions[3] duplicate of discipline-exceptions/file-carve-outs/pd-1.json exceptions[1]\n");
  });

  it("renders a duplicate invalid record with the index it duplicates", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [{ place: { layout: "single-file", file: RECORDS_FILE, index: 3 }, problem: { kind: "duplicate", of: { layout: "single-file", file: RECORDS_FILE, index: 1 } } }],
        },
      }),
    ).toContain("\nexceptions[3] duplicate of 1\n");
  });

  it.each<readonly [Unmeasured, string]>([
    [
      { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
      "forfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; pass --base-revision with the branch's base, such as origin/main, or leave decay to another run with \"assessment\": { \"forfeiture\": \"elsewhere\" } in disciplines.json or --forfeiture elsewhere",
    ],
    [
      { kind: "forfeiture-unmeasured", base: { state: "git-failed", revision: "HEAD@{1 week ago}", gitMessage: "fatal: bad \"range\"" } },
      "forfeiture-unmeasured base-git-failed \"HEAD@{1 week ago}\": git could not list the files changed since that revision and said \"fatal: bad \\\"range\\\"\"; Hone needs that revision and the history back to where this branch left it, or leave decay to another run with \"assessment\": { \"forfeiture\": \"elsewhere\" } in disciplines.json or --forfeiture elsewhere",
    ],
    [
      { kind: "import-unmeasured", base: { state: "not-given" } },
      "import-unmeasured no-base-revision: no --base-revision was given, so imported records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main",
    ],
    [
      { kind: "import-unmeasured", base: { state: "git-failed", revision: "HEAD", gitMessage: "fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'" } },
      "import-unmeasured base-git-failed \"HEAD\": git could not read the exception records at that revision and said \"fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'\"; Hone needs the exception records as they were at that revision",
    ],
    [
      { kind: "legacy-chain-unmeasured", base: { state: "not-given" } },
      "legacy-chain-unmeasured no-base-revision: no --base-revision was given, so legacy-chain records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main",
    ],
    [
      { kind: "legacy-chain-unmeasured", base: { state: "git-failed", revision: "HEAD", gitMessage: "fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'" } },
      "legacy-chain-unmeasured base-git-failed \"HEAD\": git could not read the exception records at that revision and said \"fatal: path 'pkg/discipline-exceptions.json' does not exist in 'HEAD'\"; Hone needs the exception records as they were at that revision",
    ],
    [
      { kind: "mechanism-not-run", mechanism: eslint, projection: "missing" },
      "mechanism-not-run eslint missing: disciplines.eslint.mjs is not written; run node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop and commit every disciplines.eslint.mjs it writes",
    ],
    [
      { kind: "mechanism-not-run", mechanism: eslint, projection: "not-included", nestedConfigurations: [] },
      "mechanism-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.eslint.mjs, or of a package's own disciplines.eslint.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes",
    ],
  ])("renders the unmeasured entry %o as the line with its reason and next step", (unmeasured, line) => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, unmeasured: [unmeasured] } }),
    ).toContain(`\n${line}\n`);
  });

  it.each<readonly [ProjectionProblem, string]>([
    [
      { scope: "projection", mechanism: eslint, state: "out-of-date" },
      "eslint out-of-date: disciplines.eslint.mjs differs from what hone project writes now; run node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop and commit every disciplines.eslint.mjs it writes",
    ],
    [
      { scope: "slice", mechanism: eslint, state: "out-of-date", slice: SLICE },
      "eslint out-of-date packages/a/disciplines.eslint.mjs: that slice differs from what hone project writes now; run node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop and commit every disciplines.eslint.mjs it writes",
    ],
    [
      { scope: "slice", mechanism: eslint, state: "missing", slice: SLICE },
      "eslint missing packages/a/disciplines.eslint.mjs: that slice is not written; run node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop and commit every disciplines.eslint.mjs it writes",
    ],
    [
      { scope: "slice", mechanism: eslint, state: "not-applied", slice: SLICE },
      "eslint not-applied packages/a/disciplines.eslint.mjs: the eslint configuration for packages/a leaves records of that slice out of effect; spread the default export of packages/a/disciplines.eslint.mjs last in that package's configuration, in place of any other projection it spreads, or, where a tool such as sku generates the configuration, last in the configuration the tool takes",
    ],
    [
      { scope: "slice", mechanism: eslint, state: "unconfigured", slice: SLICE },
      "eslint unconfigured packages/a/disciplines.eslint.mjs: packages/a has no eslint configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check",
    ],
  ])("renders the projection problem %o as the line with its reason and next step", (problem, line) => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, projectionProblems: [problem] } }),
    ).toContain(`\n${line}\n`);
  });

  it("points a not-included line at the slice lines when the mechanism reports package slices", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unmeasured: [{ kind: "mechanism-not-run", mechanism: eslint, projection: "not-included", nestedConfigurations: [] }],
          projectionProblems: [{ scope: "slice", mechanism: eslint, state: "not-applied", slice: SLICE }],
        },
      }),
    ).toContain(`\n${"mechanism-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.eslint.mjs, or of a package's own disciplines.eslint.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the eslint lines under projectionProblems name the package slices involved"}\n`);
  });

  it("does not point a not-included line at another mechanism's slice lines", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          unmeasured: [{ kind: "mechanism-not-run", mechanism: eslint, projection: "not-included", nestedConfigurations: [] }],
          projectionProblems: [{ scope: "slice", mechanism: audit, state: "not-applied", slice: SLICE }],
        },
      }),
    ).toContain(`\n${"mechanism-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.eslint.mjs, or of a package's own disciplines.eslint.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes"}\n`);
  });

  it("adds the folders holding their own disciplines.json to a not-included line in the failures-only output, without marking the verdict partial", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "failures-only",
        report: {
          ...emptyReport,
          unmeasured: [
            {
              kind: "mechanism-not-run",
              mechanism: eslint,
              projection: "not-included",
              nestedConfigurations: repoPathSchema.array().parse(["fixtures/a", "fixtures/b"]),
            },
          ],
        },
      }),
    ).toBe(`unmeasured (1)\n${"mechanism-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.eslint.mjs, or of a package's own disciplines.eslint.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; fixtures/a, fixtures/b hold their own disciplines.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its disciplines.json and keep its records here, then run node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop, which writes its slice"}\nverdict: fail\n`);
  });

  it("names the command it was given to refresh a projection", () => {
    expect(
      renderReportText({
        projectCommand: "node src/hone.ts project --repo \"my repo\"",
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, projectionProblems: [{ scope: "projection", mechanism: eslint, state: "out-of-date" }] },
      }),
    ).toContain("; run node src/hone.ts project --repo \"my repo\" and commit every disciplines.eslint.mjs it writes\n");
  });

  it("names the prune and project commands last in readFirst when paid debt is recorded for a projected mechanism", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, stale: [carved], readFirst: [{ kind: "paid-debt", fileCarveOuts: 3, projections: [eslint] }] },
      }),
    ).toBe(
      `stale (1)\nCD-14#no-class-syntax audit file-carve-out src/a.ts\nreadFirst (1)\nprune-debt: 3 file carve-outs under stale or forfeited still record debt that is paid; run ${PRUNE_COMMAND} to remove what is paid, then run ${PROJECT_COMMAND} and commit the exception records with every disciplines.eslint.mjs it writes\nverdict: fail\n`,
    );
  });

  it("names only the prune command when the paid debt is recorded for no projected mechanism", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, readFirst: [{ kind: "paid-debt", fileCarveOuts: 1, projections: [] }] },
      }),
    ).toBe(
      `readFirst (1)\nprune-debt: 1 file carve-out under stale or forfeited still records debt that is paid; run ${PRUNE_COMMAND} to remove what is paid, and commit the exception records it changes\nverdict: pass\n`,
    );
  });
});

describe("renderReportText sections", () => {
  it("heads a section with its field name and its count", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, stale: [located, carvedEverywhere] } }),
    ).toMatch(/^stale \(2\)$/m);
  });

  it("renders a section's entries in the list's order beneath its header", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, stale: [located, carvedEverywhere] } }),
    ).toContain(
      "stale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\n",
    );
  });

  it("orders sections as the report's fields are ordered", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          projectionProblems: [{ scope: "projection", mechanism: eslint, state: "out-of-date" }],
          stale: [located],
          findings: [finding],
        },
      }),
    ).toMatch(/^findings \(1\)$[\s\S]*^stale \(1\)$[\s\S]*^projectionProblems \(1\)$/m);
  });

  it("leaves out the section of an empty list", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, findings: [finding] } }),
    ).not.toMatch(/^stale \(/m);
  });

  it("renders a report with one finding and one stale record exactly, ending with verdict: fail", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, findings: [finding], stale: [located] } }),
    ).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nstale (1)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nverdict: fail\n",
    );
  });

  it("renders a report whose only entries are exempted exactly, ending with verdict: pass", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [located] }] },
      }),
    ).toBe(
      "exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by authorised-location imported from fictional unit fixture core/verdict/report-text.test.ts#located; not historical authorisation\nverdict: pass\n",
    );
  });

  it("names no import for an exempting record that gives only a reason", () => {
    const reasoned: ExceptionRecord = { kind: "authorised-location", clause: noClass, mechanism: audit, file: fileA, reason: located.reason };

    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [reasoned] }] },
      }),
    ).toBe("exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by authorised-location\nverdict: pass\n");
  });

  it("renders an empty report as exactly the pass verdict line", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: emptyReport })).toBe("verdict: pass\n");
  });

  it("renders a refused file holding a forged verdict line as one escaped line", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          invalidRecords: [
            { place: { layout: "single-file", file: RECORDS_FILE, index: 0 }, problem: { kind: "file-not-repo-path", file: "/x\nverdict: pass" } },
          ],
        },
      }),
    ).toBe(String.raw`invalidRecords (1)
exceptions[0] file-not-repo-path /x\nverdict: pass
verdict: fail
`);
  });
});

const mixedReport: CheckReport = {
  ...emptyReport,
  excluded: [repoPathSchema.parse("generated")],
  findings: [finding],
  exempted: [{ finding, by: [carved] }],
  stale: [located, carvedEverywhere],
};

describe("renderReportText outputs", () => {
  it("renders every section of a failing report for the full output", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: mixedReport })).toBe(
      "excluded (1)\ngenerated\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nexempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out\nstale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\nverdict: fail\n",
    );
  });

  it("renders the failing sections and the verdict without excluded or exempted for the failures-only output", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "failures-only", report: mixedReport })).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nstale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\nverdict: fail\n",
    );
  });

  it("renders one count line per non-empty section, marking the informational ones, and the verdict for the counts output", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "counts", report: mixedReport })).toBe(
      "excluded (1) informational\nfindings (1)\nexempted (1) informational\nstale (2)\nverdict: fail\n",
    );
  });

  it("renders only the verdict line for the verdict-only output", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "verdict-only", report: mixedReport })).toBe("verdict: fail\n");
  });

  it("renders only the pass verdict for the failures-only output of a report whose only entries are informational", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "failures-only",
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated")], exempted: [{ finding, by: [carved] }] },
      }),
    ).toBe("verdict: pass\n");
  });

  it.each(reportOutputSchema.options)("ends the %s output of a failing report with the fail verdict", (output) => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output, report: mixedReport })).toMatch(/(?:^|\n)verdict: fail\n$/);
  });

  it.each(reportOutputSchema.options)("ends the %s output of a passing report with the pass verdict", (output) => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output, report: { ...emptyReport, exempted: [{ finding, by: [carved] }] } })).toMatch(
      /(?:^|\n)verdict: pass\n$/,
    );
  });
});
const forfeitureElsewhere = (request: { readonly fileCarveOuts: number }): PartialAssessment => ({
  concern: "forfeiture",
  assessedBy: "elsewhere",
  fileCarveOuts: request.fileCarveOuts,
});

describe("renderReportText assessment", () => {
  it("renders forfeiture elsewhere with its count of file carve-outs not checked for decay, last before the verdict", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, exempted: [{ finding, by: [carved] }], assessment: [forfeitureElsewhere({ fileCarveOuts: 37 })] },
      }),
    ).toBe(
      "exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out\nassessment (1)\nforfeiture elsewhere: 37 file carve-outs not checked for decay in this run\nverdict: pass (partial assessment)\n",
    );
  });

  it("names one file carve-out in the singular", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 1 })] } }),
    ).toBe(
      "assessment (1)\nforfeiture elsewhere: 1 file carve-out not checked for decay in this run\nverdict: pass (partial assessment)\n",
    );
  });

  it("still renders the section when no file carve-out exists, so the choice is never invisible", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 0 })] } }),
    ).toBe(
      "assessment (1)\nforfeiture elsewhere: 0 file carve-outs not checked for decay in this run\nverdict: pass (partial assessment)\n",
    );
  });

  it("renders the assessment section and the marked fail verdict for a failing full report", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, findings: [finding], assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] } }),
    ).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nassessment (1)\nforfeiture elsewhere: 2 file carve-outs not checked for decay in this run\nverdict: fail (partial assessment)\n",
    );
  });
});

describe("renderReportText assessment outputs", () => {
  it("leaves the informational assessment section out of failures-only but keeps the marked verdict", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "failures-only",
        report: { ...emptyReport, findings: [finding], assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] },
      }),
    ).toBe("findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail (partial assessment)\n");
  });

  it("counts the assessment section as informational and marks the verdict for the counts output", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "counts",
        report: { ...emptyReport, findings: [finding], assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] },
      }),
    ).toBe("findings (1)\nassessment (1) informational\nverdict: fail (partial assessment)\n");
  });

  it("marks the verdict for the verdict-only output", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "verdict-only", report: { ...emptyReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] } }),
    ).toBe("verdict: pass (partial assessment)\n");
  });

  it.each(reportOutputSchema.options)("never prints a bare verdict for the %s output of a partial assessment", (output) => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output, report: { ...mixedReport, assessment: [forfeitureElsewhere({ fileCarveOuts: 2 })] } }),
    ).toMatch(/(?:^|\n)verdict: fail \(partial assessment\)\n$/);
  });

  it.each(reportOutputSchema.options)("prints the bare verdict for the %s output of a full assessment", (output) => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output, report: mixedReport })).toMatch(/(?:^|\n)verdict: fail\n$/);
  });
});

const namingConvention = clauseAddressSchema.parse("CD-6#naming-convention");

describe("renderReportText clauses not adopted", () => {
  it("lists the not-adopted clauses after the excluded paths and before the findings", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated")], notAdopted: [namingConvention], findings: [finding] },
      }),
    ).toBe(
      "excluded (1)\ngenerated\nnotAdopted (1)\nCD-6#naming-convention\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("passes as a whole assessment when the report lists only not-adopted clauses", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: { ...emptyReport, notAdopted: [namingConvention] } })).toBe(
      "notAdopted (1)\nCD-6#naming-convention\nverdict: pass\n",
    );
  });

  it("counts the not-adopted clauses as informational", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "counts", report: { ...emptyReport, notAdopted: [namingConvention] } })).toBe(
      "notAdopted (1) informational\nverdict: pass\n",
    );
  });

  it("renders a clause-not-adopted invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, invalidRecords: [{ place: { layout: "single-file", file: RECORDS_FILE, index: 2 }, problem: { kind: "clause-not-adopted", clause: namingConvention } }] },
      }),
    ).toContain("\nexceptions[2] clause-not-adopted CD-6#naming-convention\n");
  });
});

describe("renderReportText clauses adopted but not run", () => {
  it("lists the not-run clauses after the not-adopted ones, each as adopted and owed to review", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, notAdopted: [namingConvention], notRun: [probeNoTmp], findings: [finding] },
      }),
    ).toBe(
      "notAdopted (1)\nCD-6#naming-convention\nnotRun (1)\nprobe/PD-1#no-tmp-files adopted, mechanism not run: enforced by review\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("passes as a whole assessment when the report lists only not-run clauses", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "counts", report: { ...emptyReport, notRun: [probeNoTmp] } })).toBe(
      "notRun (1) informational\nverdict: pass\n",
    );
  });

  it("renders a clause-not-run invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, invalidRecords: [{ place: { layout: "single-file", file: RECORDS_FILE, index: 1 }, problem: { kind: "clause-not-run", clause: probeNoTmp } }] },
      }),
    ).toContain("\nexceptions[1] clause-not-run probe/PD-1#no-tmp-files\n");
  });
});

const loops = clauseAddressSchema.parse("CD-15#loops");

const loopsFinding: Finding = { ...finding, clause: loops, snippet: "const total = 0;" };

const readingOf = (request: {
  readonly clause: ClauseReading["clause"];
  readonly assessmentSection: ClauseReading["assessmentSection"];
  readonly presence: ClauseReading["rulePage"]["presence"];
}): ClauseReading => ({
  kind: "clause",
  clause: request.clause,
  assessmentSection: request.assessmentSection,
  rulePage: { path: `rules/${request.clause.discipline}/README.md`, presence: request.presence },
});

const pointedReport: CheckReport = {
  ...emptyReport,
  findings: [finding, loopsFinding],
  readFirst: [
    readingOf({ clause: noClass, assessmentSection: "present", presence: "present" }),
    readingOf({ clause: loops, assessmentSection: "not-assessed", presence: "present" }),
  ],
};

const unwrittenReport: CheckReport = {
  ...emptyReport,
  findings: [finding, loopsFinding],
  readFirst: [
    { kind: "assessment-file", state: "not-written", guide: "node_modules/@hailstails/hone/ADOPTING.md" },
    readingOf({ clause: noClass, assessmentSection: "unread", presence: "present" }),
    readingOf({ clause: loops, assessmentSection: "unread", presence: "present" }),
  ],
};

describe("renderReportText readFirst", () => {
  it("prints readFirst last, after the failures, so the report ends on where to read and then the verdict", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: pointedReport })).toBe(
      'findings (2)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nCD-15#loops audit src/a.ts:3:5 const total = 0;\nreadFirst (2)\nCD-14#no-class-syntax: read the "## CD-14#no-class-syntax" section of disciplines.assessment.md, then rules/CD-14/README.md#spirit\nCD-15#loops: read rules/CD-15/README.md#spirit; disciplines.assessment.md does not assess this clause\nverdict: fail\n',
    );
  });

  it("says once, first, that the assessment file is not written and where its guide is, then gives each clause its rule page", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "full", report: unwrittenReport })).toContain(
      "\nreadFirst (3)\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; node_modules/@hailstails/hone/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#no-class-syntax: read rules/CD-14/README.md#spirit\nCD-15#loops: read rules/CD-15/README.md#spirit\nverdict: fail\n",
    );
  });

  it("says once, first, that the assessment file could not be read", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          findings: [loopsFinding],
          readFirst: [
            { kind: "assessment-file", state: "unreadable", guide: "ADOPTING.md" },
            readingOf({ clause: loops, assessmentSection: "unread", presence: "present" }),
          ],
        },
      }),
    ).toContain(
      "\nreadFirst (2)\nStart from each rule's Spirit below. disciplines.assessment.md could not be read.\nCD-15#loops: read rules/CD-15/README.md#spirit\nverdict: fail\n",
    );
  });
});

describe("renderReportText readFirst without a rule page", () => {
  it.each([
    {
      section: "present",
      line: 'CD-15#loops: read the "## CD-15#loops" section of disciplines.assessment.md; its rule set has no rule page at rules/CD-15/README.md',
    },
    {
      section: "not-assessed",
      line: "CD-15#loops: its rule set has no rule page at rules/CD-15/README.md; disciplines.assessment.md does not assess this clause",
    },
    { section: "unread", line: "CD-15#loops: its rule set has no rule page at rules/CD-15/README.md" },
  ] as const)("says the rule set has no page when the section is $section", ({ section, line }) => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          findings: [loopsFinding],
          readFirst: [readingOf({ clause: loops, assessmentSection: section, presence: "absent" })],
        },
      }),
    ).toContain(`\nreadFirst (1)\n${line}\nverdict: fail\n`);
  });

  it.each([
    {
      state: "not-written",
      note: "disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; ADOPTING.md#5a-write-the-assessment says how to write it.",
    },
    { state: "unreadable", note: "disciplines.assessment.md could not be read." },
  ] as const)("points at no Spirit in the $state note when no clause line names one", ({ state, note }) => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: {
          ...emptyReport,
          findings: [loopsFinding],
          readFirst: [
            { kind: "assessment-file", state, guide: "ADOPTING.md" },
            readingOf({ clause: loops, assessmentSection: "unread", presence: "absent" }),
          ],
        },
      }),
    ).toContain(`\nreadFirst (2)\n${note}\nCD-15#loops: its rule set has no rule page at rules/CD-15/README.md\n`);
  });
});

describe("renderReportText readFirst by output", () => {
  it("keeps readFirst in the failures-only output, after the findings", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "failures-only", report: pointedReport })).toMatch(/^findings \(2\)\n(?:.*\n){2}readFirst \(2\)\n(?:.*\n){2}verdict: fail\n$/);
  });

  it("counts readFirst as guidance in the counts output, its note included", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "counts", report: unwrittenReport })).toBe("findings (2)\nreadFirst (3) guidance\nverdict: fail\n");
  });

  it("prints only the verdict for the verdict-only output", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "verdict-only", report: pointedReport })).toBe("verdict: fail\n");
  });
});

describe("renderReportText clause editions", () => {
  const editionReading = {
    address: clauseAddressSchema.parse("CD-27#test-body-logic"),
    mechanism: mechanismIdSchema.parse("audit"),
    edition: editionSchema.parse("1"),
    latest: editionSchema.parse("2"),
  };

  it("lists each clause's edition after the not-run clauses, with its mechanism and latest edition", () => {
    expect(
      renderReportText({
        projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
        output: "full",
        report: { ...emptyReport, notRun: [probeNoTmp], editions: [editionReading] },
      }),
    ).toBe(
      "notRun (1)\nprobe/PD-1#no-tmp-files adopted, mechanism not run: enforced by review\neditions (1)\nCD-27#test-body-logic audit edition 1 of 2\nverdict: pass\n",
    );
  });

  it("passes as a whole assessment when the report lists only editions", () => {
    expect(renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "counts", report: { ...emptyReport, editions: [editionReading] } })).toBe(
      "editions (1) informational\nverdict: pass\n",
    );
  });

  it("leaves editions out of a failures-only report", () => {
    expect(
      renderReportText({ projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, output: "failures-only", report: { ...emptyReport, editions: [editionReading] } }),
    ).toBe("verdict: pass\n");
  });
});

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const clockFinding: Finding = {
  clause: CLOCK_SOURCES,
  mechanism: audit,
  file: repoPathSchema.parse("src/orders/charge-order.ts"),
  anchor: { line: 14, column: 0 },
  snippet: "const chargedAt = clock.now();",
};

const clockReading: ClauseReading = {
  kind: "clause",
  clause: CLOCK_SOURCES,
  assessmentSection: "unread",
  rulePage: { path: "node_modules/@hailstails/hone/rules/CD-17/README.md", presence: "present" },
};

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" };

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: AT_A_BOUNDARY, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }] };

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "\"the world reaches a unit through a port\"", standing: "accepted" },
};

const BOUNDARY_RECORD: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: NEEDS_THE_CURRENT_TIME,
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: DOES_ONE_JOB, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD, at: "on the clock adapter" }],
};

const clockGuide: SymptomGuide = {
  guide: "catalogue",
  page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md",
  catalogue: {
    principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES],
    rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR],
    cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB],
    recipes: [WORLD_VALUES_THROUGH_A_PORT],
    recordKinds: [AUTHORISED_LOCATION, BOUNDARY_RECORD, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [DATE_USED_DIRECTLY],
    clauses: [{ clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } }],
    checks: [],
    namedBans: [],
  },
};

describe("renderGuidedReportText", () => {
  it("names a finding's symptom on its line, and puts the symptom's note in readFirst ahead of the clause line", () => {
    expect(
      renderGuidedReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        guide: clockGuide,
        report: { ...emptyReport, findings: [clockFinding], readFirst: [clockReading] },
      }),
    ).toBe(
      "findings (1)\nCD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); symptom: date-used-directly, may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator\nreadFirst (2)\ndate-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#date-used-directly\nCD-17#clock-sources: read node_modules/@hailstails/hone/rules/CD-17/README.md#spirit\nverdict: fail\n",
    );
  });

  it("prints exactly what renderReportText prints when there is no catalogue", () => {
    expect(
      renderGuidedReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        guide: NO_SYMPTOM_GUIDE,
        report: { ...emptyReport, findings: [clockFinding], readFirst: [clockReading] },
      }),
    ).toBe(
      "findings (1)\nCD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now();\nreadFirst (1)\nCD-17#clock-sources: read node_modules/@hailstails/hone/rules/CD-17/README.md#spirit\nverdict: fail\n",
    );
  });

  it("prints the findings and verdict as with no catalogue, and opens readFirst saying the catalogue was not read, when it was not", () => {
    expect(
      renderGuidedReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        guide: { guide: "unreadable", failure: "file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end" },
        report: { ...emptyReport, findings: [clockFinding], readFirst: [clockReading] },
      }),
    ).toBe(
      "findings (1)\nCD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now();\nreadFirst (2)\nsymptom catalogue not read, so no finding names its symptom: file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end\nCD-17#clock-sources: read node_modules/@hailstails/hone/rules/CD-17/README.md#spirit\nverdict: fail\n",
    );
  });

  it("says the catalogue was not read on a passing report, which still passes", () => {
    expect(
      renderGuidedReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        guide: { guide: "unreadable", failure: "file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end" },
        report: emptyReport,
      }),
    ).toBe(
      "readFirst (1)\nsymptom catalogue not read, so no finding names its symptom: file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end\nverdict: pass\n",
    );
  });

  it("leaves an exempted finding's line unnamed", () => {
    expect(
      renderGuidedReportText({
        projectCommand: PROJECT_COMMAND,
        pruneCommand: PRUNE_COMMAND,
        output: "full",
        guide: clockGuide,
        report: { ...emptyReport, exempted: [{ finding: clockFinding, by: [carved] }] },
      }),
    ).toBe(
      "exempted (1)\nCD-17#clock-sources audit src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); exempted by file-carve-out\nverdict: pass\n",
    );
  });
});
