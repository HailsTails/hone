import { describe, expect, it } from "vitest";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "../../../../tests/version-one-causal-why-chain.ts";
import { LOOPS_CLAUSE, SETTINGS_CATALOGUE, TEST_BODY_CLAUSE } from "../../../../tests/settings-catalogue.ts";
import type { Finding } from "../../../infrastructure/command-line/governance.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { TOOL_RULE_SET } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { GovernanceResult } from "../../../domain/records/discipline-exceptions/governance.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { recordAnswersOf } from "./record-answers.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const SRC_A = repoPathSchema.parse("src/a.ts");

const [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] = SETTINGS_CATALOGUE.checks;

const CARVE_OUT: ExceptionRecord = { kind: "file-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "legacy loop" };

const AUTHORISED: ExceptionRecord = { kind: "authorised-location", clause: TEST_BODY_CLAUSE, mechanism: AUDIT, file: SRC_A, reason: "kept" };

const LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const NOTHING_GOVERNED: GovernanceResult = { findings: [], exempted: [], stale: [], forfeited: [], doublyHeld: [], unrecorded: [] };

const catalogues: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

describe("recordAnswersOf crediting a file carve-out with the findings it exempted", () => {
  it("credits the check a finding names", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] },
        catalogues,
      }),
    ).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] });
  });

  it("credits each check of the findings a carve-out exempted, in the order the findings came", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const forLoop: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: "loop-keyword#test-body" };
    const rebinding: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: "rebinding#test-body" };
    expect(
      recordAnswersOf({
        records: [carveOut],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: forLoop, by: [carveOut] },
            { finding: rebinding, by: [carveOut] },
          ],
        },
        catalogues,
      }),
    ).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", record: carveOut, answer: { credit: "findings", checks: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] } }] });
  });

  it("credits the one check of the clause run by the finding's mechanism when the finding names none", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, mechanism: ESLINT, check: undefined }, by: [CARVE_OUT] }] },
        catalogues,
      }),
    ).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "findings", checks: [LOOP_KEYWORD_LOOPS] } }] });
  });

  it("fails when a finding names no check and its mechanism runs two checks of the clause", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    expect(
      recordAnswersOf({
        records: [carveOut],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: undefined }, by: [carveOut] }] },
        catalogues,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-27#test-body-logic", file: "src/a.ts", check: undefined } });
  });

  it("credits the check the finding's symptom reading picks when its mechanism runs two checks of the clause", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const letFinding: Finding = {
      ...LOOP_FINDING,
      clause: TEST_BODY_CLAUSE,
      check: undefined,
      remedy: { fix: "bind it once", page: "rules/CD-27/README.md", section: "a-let" },
    };
    expect(
      recordAnswersOf({ records: [carveOut], governed: { ...NOTHING_GOVERNED, exempted: [{ finding: letFinding, by: [carveOut] }] }, catalogues }),
    ).toEqual({ outcome: "ok", value: [{ kind: "file-carve-out", record: carveOut, answer: { credit: "findings", checks: [REBINDING_TEST_BODY] } }] });
  });

  it("fails when a finding names a check its mechanism does not run, which version 2 would never site", () => {
    const carveOut: ExceptionRecord = { ...CARVE_OUT, clause: TEST_BODY_CLAUSE };
    const eslintFinding: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, mechanism: ESLINT, check: "rebinding#test-body" };
    expect(
      recordAnswersOf({ records: [carveOut], governed: { ...NOTHING_GOVERNED, exempted: [{ finding: eslintFinding, by: [carveOut] }] }, catalogues }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-27#test-body-logic", file: "src/a.ts", check: "rebinding#test-body" } });
  });

  it("fails when a finding's clause belongs to a rule set with no catalogue", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: LOOP_FINDING, by: [CARVE_OUT] }] },
        catalogues: [],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-15#loops", file: "src/a.ts", check: "loop-keyword#loops" } });
  });

  it("fails when a finding names a check the clause does not hold", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, check: "rebinding#test-body" }, by: [CARVE_OUT] }] },
        catalogues,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-15#loops", file: "src/a.ts", check: "rebinding#test-body" } });
  });
});

describe("recordAnswersOf answering a file carve-out that exempted no finding", () => {
  it("answers nothing for a carve-out the governance found stale", () => {
    expect(recordAnswersOf({ records: [CARVE_OUT], governed: { ...NOTHING_GOVERNED, stale: [CARVE_OUT] }, catalogues })).toEqual({
      outcome: "ok",
      value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } }],
    });
  });

  it("answers suppression-only for a carve-out that is neither stale nor credited a finding, held up by a native suppression alone", () => {
    expect(recordAnswersOf({ records: [CARVE_OUT], governed: NOTHING_GOVERNED, catalogues })).toEqual({
      outcome: "ok",
      value: [{ kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "suppression-only" } }],
    });
  });

  it("fails for a carve-out on a clause and file an authorised location also holds", () => {
    expect(
      recordAnswersOf({
        records: [CARVE_OUT],
        governed: { ...NOTHING_GOVERNED, doublyHeld: [{ clause: LOOPS_CLAUSE, file: SRC_A, mechanism: AUDIT }] },
        catalogues,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "record-doubly-held", clause: "CD-15#loops", file: "src/a.ts" } });
  });
});

describe("recordAnswersOf crediting an authorised location with the findings it exempted", () => {
  const authorisedOnLoops: ExceptionRecord = { ...AUTHORISED, clause: LOOPS_CLAUSE };

  it("credits the check a finding names, and no other check of the clause", () => {
    expect(
      recordAnswersOf({
        records: [authorisedOnLoops],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: LOOP_FINDING, by: [authorisedOnLoops] }] },
        catalogues,
      }),
    ).toEqual({ outcome: "ok", value: [{ kind: "authorised-location", record: authorisedOnLoops, answer: { reach: "answered-checks", checks: [LOOP_KEYWORD_LOOPS] } }] });
  });

  it("credits each check of the findings it exempted, in the order the findings came", () => {
    const forLoop: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: "loop-keyword#test-body" };
    const rebinding: Finding = { ...LOOP_FINDING, clause: TEST_BODY_CLAUSE, check: "rebinding#test-body" };
    expect(
      recordAnswersOf({
        records: [AUTHORISED],
        governed: {
          ...NOTHING_GOVERNED,
          exempted: [
            { finding: forLoop, by: [AUTHORISED] },
            { finding: rebinding, by: [AUTHORISED] },
          ],
        },
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ kind: "authorised-location", record: AUTHORISED, answer: { reach: "answered-checks", checks: [LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY] } }],
    });
  });

  it("keeps the whole clause for a location that exempted no finding, stale or held up by a native suppression", () => {
    expect(recordAnswersOf({ records: [AUTHORISED], governed: { ...NOTHING_GOVERNED, stale: [AUTHORISED] }, catalogues })).toEqual({
      outcome: "ok",
      value: [{ kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } }],
    });
    expect(recordAnswersOf({ records: [AUTHORISED], governed: NOTHING_GOVERNED, catalogues })).toEqual({
      outcome: "ok",
      value: [{ kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } }],
    });
  });

  it("fails when a finding it exempted cannot be sited at a check", () => {
    expect(
      recordAnswersOf({
        records: [authorisedOnLoops],
        governed: { ...NOTHING_GOVERNED, exempted: [{ finding: { ...LOOP_FINDING, check: "rebinding#test-body" }, by: [authorisedOnLoops] }] },
        catalogues,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "finding-not-attributable", clause: "CD-15#loops", file: "src/a.ts", check: "rebinding#test-body" } });
  });
});

describe("recordAnswersOf over every record of the file", () => {
  it("answers each file carve-out and authorised location, in the order the records were given, and leaves a clause-wide carve-out out", () => {
    const second: ExceptionRecord = { ...CARVE_OUT, file: repoPathSchema.parse("src/b.ts") };
    const clauseWide: ExceptionRecord = { kind: "clause-wide-carve-out", clause: LOOPS_CLAUSE, mechanism: AUDIT, reason: "generated", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN };
    expect(
      recordAnswersOf({
        records: [AUTHORISED, CARVE_OUT, clauseWide, second],
        governed: { ...NOTHING_GOVERNED, stale: [CARVE_OUT, second] },
        catalogues,
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "authorised-location", record: AUTHORISED, answer: { reach: "whole-clause" } },
        { kind: "file-carve-out", record: CARVE_OUT, answer: { credit: "nothing" } },
        { kind: "file-carve-out", record: second, answer: { credit: "nothing" } },
      ],
    });
  });
});
