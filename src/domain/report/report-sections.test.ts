import { describe, expect, it } from "vitest";
import type { PlacedRecord } from "../records/hone-records/hone-record.ts";
import { RUN_SECTION_NAMES, type RunSectionName, type RunSectionRole, runSectionRoleOf, runVerdictOf } from "./report-sections.ts";
import type { RunReport } from "./run-report.ts";
import type { Check, Symptom } from "../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../repository/repo-path-of.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: {
        name: "gives-a-value-its-type",
        title: "Gives a value its type",
        standing: "accepted",
        owes: [
          {
            kind: "rule",
            rule: {
              name: "declared-not-asserted",
              title: "Declared, not asserted",
              principle: { name: "one-place-decides", title: "One place decides" },
              standing: "accepted",
            },
          },
        ],
      },
      situation: "or needs it narrower",
      points: [
        {
          kind: "rule",
          rule: {
            name: "declared-not-asserted",
            title: "Declared, not asserted",
            principle: { name: "one-place-decides", title: "One place decides" },
            standing: "accepted",
          },
        },
      ],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    {
      situation: "a schema proves the type",
      kind: { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
    },
  ],
};

const EMPTY_REPORT: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  available: [],
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

describe("RUN_SECTION_NAMES", () => {
  it("names every section in the order the report prints them", () => {
    expect(RUN_SECTION_NAMES).toEqual([
      "excluded",
      "not-adopted",
      "not-run",
      "editions",
      "findings",
      "answered",
      "available",
      "stale",
      "forfeited",
      "unrecorded",
      "misnamed",
      "paid",
      "refused",
      "unmeasured",
      "projection-problems",
      "assessment",
      "settings-notes",
      "record-notes",
      "carried",
      "symptoms",
    ]);
  });
});

describe("runSectionRoleOf", () => {
  it.each<{ readonly section: RunSectionName; readonly role: RunSectionRole }>([
    { section: "findings", role: "failing" },
    { section: "answered", role: "informational" },
    { section: "available", role: "informational" },
    { section: "paid", role: "next-step" },
    { section: "refused", role: "failing" },
    { section: "settings-notes", role: "informational" },
    { section: "record-notes", role: "informational" },
    { section: "carried", role: "informational" },
    { section: "symptoms", role: "guidance" },
  ])("gives $section the role $role", ({ section, role }) => {
    expect(runSectionRoleOf({ section })).toBe(role);
  });
});

describe("runVerdictOf", () => {
  it("passes a run whose failing sections are all empty, whatever its informational sections hold", () => {
    expect(runVerdictOf({ report: { ...EMPTY_REPORT, excluded: [repoPathOf("dist")], "settings-notes": [{ kind: "declared-not-read", key: "layers" }] } })).toBe("pass");
  });

  it("passes a run whose only entries are paid debt and a record's catalogue note, since neither fails a run", () => {
    const debt: PlacedRecord = {
      place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
      record: { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "whole-symptom" }, file: repoPathOf("src/a.ts"), holding: { held: "stated" } },
    };
    const location: PlacedRecord = {
      place: { file: repoPathOf("hone-records/authorised-locations/claimed-type.json"), index: 0 },
      record: {
        kind: "authorised-location",
        symptom: CLAIMED_TYPE,
        reach: { reaches: "unknown-check", check: "cast-old" },
        file: repoPathOf("src/a.ts"),
        holding: { held: "carried", entry: {}, lacks: ["case", "owes", "whyChain"], standing: "established" },
      },
    };
    expect(
      runVerdictOf({
        report: {
          ...EMPTY_REPORT,
          paid: [{ debt, answeredBy: [location] }],
          "record-notes": [{ place: location.place, note: { kind: "unknown-check", symptom: CLAIMED_TYPE, check: "cast-old" } }],
        },
      }),
    ).toBe("pass");
  });

  it("passes a run whose only entries are checks available to list, since an offer never fails a run", () => {
    const castExpressions: Check = {
      name: "cast-expressions",
      symptom: CLAIMED_TYPE,
      clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") },
      engines: [{ name: "eslint", mechanism: "eslint" }],
      forms: [],
    };
    expect(runVerdictOf({ report: { ...EMPTY_REPORT, available: [castExpressions] } })).toBe("pass");
  });

  it("fails a run with an entry in a failing section", () => {
    expect(runVerdictOf({ report: { ...EMPTY_REPORT, refused: [{ place: { file: repoPathOf("hone-records/boundary-records.json"), index: 0 }, refusals: [{ kind: "carried-changed-since-base" }] }] } })).toBe(
      "fail",
    );
  });
});
