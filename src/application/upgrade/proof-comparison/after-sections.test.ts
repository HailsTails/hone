import { describe, expect, it } from "vitest";
import { LOOP_KEYWORD_LOOPS, LOOPS_CLAUSE, SETTINGS_CATALOGUE } from "../../../../tests/settings-catalogue.ts";
import type { Finding } from "../../../infrastructure/command-line/governance.ts";
import type { PlacedRecord } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import type { RunReport } from "../../../domain/report/run-report.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { TOOL_RULE_SET } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { afterSectionsOf } from "./after-sections.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const SRC_A = repoPathSchema.parse("src/a.ts");

const EMPTY_AFTER: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  "projection-problems": [],
  assessment: [],
  "settings-notes": [],
  "record-notes": [],
  carried: [],
  symptoms: [],
};

const NAMED_LOOP_FINDING: Finding = {
  clause: LOOPS_CLAUSE,
  file: SRC_A,
  anchor: { line: 3, column: 1 },
  snippet: "the loop line",
  mechanism: AUDIT,
  check: "loop-keyword#loops",
};

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/loop-keyword.json"), index: 0 },
  record: { kind: "debt", symptom: LOOP_KEYWORD_LOOPS.symptom, reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS }, file: SRC_A, holding: { held: "stated" } },
};

const CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: TOOL_RULE_SET, catalogue: SETTINGS_CATALOGUE }];

const sectionsOf = (request: { readonly report: RunReport }) => afterSectionsOf({ report: request.report, catalogues: CATALOGUES });

const sectionsOfWithoutCatalogues = (request: { readonly report: RunReport }) => afterSectionsOf({ report: request.report, catalogues: [] });

describe("afterSectionsOf", () => {
  it("holds nothing but a passing verdict for a report that holds nothing", () => {
    expect(sectionsOf({ report: EMPTY_AFTER })).toEqual({
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

  it("keys each section of a report, a finding at the clause of the check it names and a record by its file", () => {
    expect(
      sectionsOf({
        report: {
          ...EMPTY_AFTER,
          excluded: [repoPathSchema.parse("generated")],
          findings: [{ ...NAMED_LOOP_FINDING, check: "rebinding#test-body" }],
          answered: [{ finding: NAMED_LOOP_FINDING, by: [DEBT] }],
          misnamed: [{ kind: "names-no-check", ruleId: "hone/loop-keyword#none", file: SRC_A, line: 4, text: "eslint-disable" }],
          paid: [{ debt: DEBT, answeredBy: [DEBT] }],
          stale: [{ placed: DEBT, reason: "credited-nothing" }],
          forfeited: [DEBT],
          uncovered: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_LOOPS],
          "not-run": [LOOP_KEYWORD_LOOPS],
          "projection-problems": [{ scope: "slice", engine: { name: "walker", mechanism: AUDIT }, state: "missing", slice: repoPathSchema.parse("packages/web") }],
          unmeasured: [{ kind: "engine-not-run", engine: { name: "walker", mechanism: AUDIT }, projection: "missing" }],
          assessment: [{ concern: "forfeiture", assessedBy: "elsewhere", debts: 1 }],
        },
      }),
    ).toEqual({
      excluded: ["generated"],
      findings: ["CD-27#test-body-logic src/a.ts 3:1"],
      answered: ["CD-15#loops src/a.ts 3:1 answered by debt"],
      unrecorded: [],
      misnamed: ["names-no-check hone/loop-keyword#none src/a.ts 4"],
      paid: ["hone-records/debt/loop-keyword.json 0"],
      stale: ["src/a.ts"],
      forfeited: ["src/a.ts"],
      "doubly-held": [],
      "invalid-records": [],
      uncovered: ["CD-15#loops"],
      "not-adopted": [],
      "not-run": ["CD-15#loops"],
      editions: [],
      unmeasured: ["audit not-run missing"],
      "projection-problems": ["slice audit missing packages/web"],
      assessment: ["forfeiture elsewhere"],
      verdict: ["fail"],
    });
  });

  it("keys a finding naming no check as an unknown check, never at its own clause", () => {
    expect(sectionsOf({ report: { ...EMPTY_AFTER, findings: [{ ...NAMED_LOOP_FINDING, check: undefined }] } }).findings).toEqual(["unknown-check none src/a.ts 3:1"]);
  });

  it("keys a finding naming a check the catalogue does not hold as that unknown check", () => {
    expect(sectionsOf({ report: { ...EMPTY_AFTER, findings: [{ ...NAMED_LOOP_FINDING, check: "loop-keyword#lops" }] } }).findings).toEqual([
      "unknown-check loop-keyword#lops src/a.ts 3:1",
    ]);
  });

  it("keys a finding of a rule set no catalogue was given for as an unknown check", () => {
    expect(sectionsOfWithoutCatalogues({ report: { ...EMPTY_AFTER, findings: [NAMED_LOOP_FINDING] } }).findings).toEqual([
      "unknown-check loop-keyword#loops src/a.ts 3:1",
    ]);
  });
});
