import { describe, expect, it } from "vitest";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "../../../../tests/version-one-causal-why-chain.ts";
import { LOOPS_CLAUSE } from "../../../../tests/settings-catalogue.ts";
import type { AttributedNativeException, Finding } from "../../../infrastructure/command-line/governance.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { answeredKeyOf, beforeSectionsOf, findingKeyOf, nativeKeyOf } from "./before-sections.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const EMPTY_BEFORE: CheckReport = {
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

const LOOP_FINDING: Finding = { clause: LOOPS_CLAUSE, file: SRC_A, anchor: { line: 3, column: 1 }, snippet: "the loop line", mechanism: AUDIT };

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const CLAUSE_WIDE: ExceptionRecord = { kind: "clause-wide-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, reason: "generated", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN };

const COMMAND_LINE_OPTION: AttributedNativeException = {
  kind: "command-line-option",
  clause: LOOPS_CLAUSE,
  location: repoPathSchema.parse("package.json"),
  script: "lint",
  option: "--ignore-pattern",
  cause: { kind: "weakens-run" },
  mechanism: AUDIT,
};

describe("findingKeyOf", () => {
  it("names the clause, file and anchor", () => {
    expect(findingKeyOf({ finding: LOOP_FINDING, clauseText: "CD-15#loops" })).toBe("CD-15#loops src/a.ts 3:1");
  });
});

describe("answeredKeyOf", () => {
  it("names each answering kind once, sorted", () => {
    expect(answeredKeyOf({ findingKey: "k", kinds: ["debt", "authorised-location", "debt"] })).toBe("k answered by authorised-location,debt");
  });
});

describe("nativeKeyOf", () => {
  it("places a command-line option at its script and option", () => {
    expect(nativeKeyOf({ exception: COMMAND_LINE_OPTION })).toBe("audit command-line-option CD-15#loops package.json lint --ignore-pattern");
  });

  it("places an ignore at its file", () => {
    expect(nativeKeyOf({ exception: { kind: "ignore", clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT } })).toBe("audit ignore CD-15#loops src/a.ts");
  });
});

describe("beforeSectionsOf", () => {
  it("holds nothing but a passing verdict for a report that holds nothing", () => {
    expect(beforeSectionsOf({ report: EMPTY_BEFORE })).toEqual({
      excluded: [],
      findings: [],
      answered: [],
      unrecorded: [],
      misnamed: [],
      paid: [],
      stale: [],
      forfeited: [],
      "doubly-held": [],
      "invalid-records": [],
      uncovered: [],
      "not-adopted": [],
      "not-run": [],
      editions: [],
      unmeasured: [],
      "projection-problems": [],
      assessment: [],
      verdict: ["pass"],
    });
  });

  it("keys each section of a report, a clause-wide carve-out by its clause and version 1's kinds as version 2's", () => {
    expect(
      beforeSectionsOf({
        report: {
          ...EMPTY_BEFORE,
          excluded: [repoPathSchema.parse("generated")],
          findings: [LOOP_FINDING],
          exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }],
          unrecorded: [COMMAND_LINE_OPTION],
          stale: [CLAUSE_WIDE],
          forfeited: [CARVE_OUT],
          doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }],
          uncovered: [LOOPS_CLAUSE, LOOPS_CLAUSE],
          notRun: [LOOPS_CLAUSE],
          projectionProblems: [{ scope: "slice", mechanism: AUDIT, state: "missing", slice: repoPathSchema.parse("packages/web") }],
          assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 1 }],
        },
      }),
    ).toEqual({
      excluded: ["generated"],
      findings: ["CD-15#loops src/a.ts 3:1"],
      answered: ["CD-15#loops src/a.ts 3:1 answered by debt"],
      unrecorded: ["audit command-line-option CD-15#loops package.json lint --ignore-pattern"],
      misnamed: [],
      paid: [],
      stale: ["CD-15#loops"],
      forfeited: ["src/a.ts"],
      "doubly-held": ["CD-15#loops src/a.ts audit"],
      "invalid-records": [],
      uncovered: ["CD-15#loops"],
      "not-adopted": [],
      "not-run": ["CD-15#loops"],
      editions: [],
      unmeasured: [],
      "projection-problems": ["slice audit missing packages/web"],
      assessment: ["forfeiture elsewhere"],
      verdict: ["fail"],
    });
  });
});
