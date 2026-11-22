import { describe, expect, it } from "vitest";
import type { Finding } from "../../../domain/finding/governance.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import type { Case, Principle, RecordKind, Rule, Symptom } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "../../printed-report/symptoms/symptom-notes.ts";
import { checkCommandOutcome, guidedCheckCommandOutcome } from "./check-command-outcome.ts";
import { REPORT_OUTPUTS } from "../../../domain/settings/report-output.ts";

const PROJECT_COMMAND = "node src/hone.ts project --repo .";

const PRUNE_COMMAND = "node src/hone.ts prune-debt --repo .";

const WALKER = mechanismIdSchema.parse("audit");

const EMPTY_REPORT: CheckReport = {
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

const CLASS_IN_A: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: WALKER,
};

describe("checkCommandOutcome", () => {
  it("exits 0 and prints the report when the verdict is pass", () => {
    expect(checkCommandOutcome({ result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } } })).toEqual({
      code: 0,
      text: "verdict: pass\n",
    });
  });

  it("exits 1 and prints the report when the verdict is fail", () => {
    expect(checkCommandOutcome({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } } })).toEqual({
      code: 1,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n",
    });
  });

  it("exits 1 when the only entry is forfeiture-unmeasured", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "ok",
          value: { report: { ...EMPTY_REPORT, unmeasured: [{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }] }, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND },
        },
      }),
    ).toEqual({
      code: 1,
      text: "unmeasured (1)\nforfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; pass --base-revision with the branch's base, such as origin/main, or leave decay to another run with \"assessment\": { \"forfeiture\": \"elsewhere\" } in disciplines.json or --forfeiture elsewhere\nverdict: fail\n",
    });
  });

  it.each(REPORT_OUTPUTS)("exits 1 for a failing report whatever the %s output prints", (output) => {
    expect(
      checkCommandOutcome({ result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output, projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } } })
        .code,
    ).toBe(1);
  });

  it.each(REPORT_OUTPUTS)("exits 0 for a passing report whatever the %s output prints", (output) => {
    expect(
      checkCommandOutcome({
        result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, excluded: [repoPathSchema.parse("generated")] }, output, projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } },
      }).code,
    ).toBe(0);
  });

  it("exits 1 printing only the failing sections and the verdict for the failures-only output", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "ok",
          value: {
            report: { ...EMPTY_REPORT, excluded: [repoPathSchema.parse("generated")], findings: [CLASS_IN_A] },
            output: "failures-only", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND,
          },
        },
      }),
    ).toEqual({ code: 1, text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n" });
  });

  it("exits 1 printing only the verdict for the verdict-only output", () => {
    expect(
      checkCommandOutcome({
        result: { outcome: "ok", value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "verdict-only", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND } },
      }),
    ).toEqual({ code: 1, text: "verdict: fail\n" });
  });
});

describe("checkCommandOutcome on a load failure", () => {
  it("exits 2 and prints the load failure line when an input could not be loaded", () => {
    expect(
      checkCommandOutcome({
        result: { outcome: "failed", error: { kind: "file-malformed", path: "/repo/disciplines.json", detail: "Unexpected end" } },
      }),
    ).toEqual({ code: 2, text: "load failure: file-malformed /repo/disciplines.json Unexpected end\n" });
  });

  it("exits 2 and prints the load failure line when the arguments are invalid", () => {
    expect(
      checkCommandOutcome({ result: { outcome: "failed", error: { kind: "arguments-invalid", detail: "--repo is required" } } }),
    ).toEqual({ code: 2, text: "load failure: arguments-invalid --repo is required\n" });
  });

  it("exits 2 and names the runner failure when a runner failed", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "failed",
          error: { kind: "runner-failed", mechanism: WALKER, failure: { kind: "runner-invalid-output", detail: "run rejected" } },
        },
      }),
    ).toEqual({ code: 2, text: "load failure: runner-failed audit runner-invalid-output run rejected\n" });
  });
});

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const KEEPS_STATE: Case = {
  name: "keeps-state-or-settings-across-calls",
  title: "Keeps state or settings across calls",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CLASS_DECLARED: Symptom = {
  name: "class-declared",
  title: "Class declared",
  seen: "A class declaration.",
  mayIndicate: [{ case: KEEPS_STATE, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] }],
  breachUsuallySits: "in the unit that holds state",
  recipes: [],
  correctUses: [],
};

const CLASS_GUIDE: SymptomGuide = {
  guide: "catalogue",
  page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md",
  catalogue: {
    principles: [ONE_PLACE_DECIDES],
    rules: [DOER_OR_ORCHESTRATOR],
    cases: [KEEPS_STATE],
    recipes: [],
    recordKinds: [AUTHORISED_LOCATION, DEBT],
    alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
    engines: [],
    symptoms: [CLASS_DECLARED],
    clauses: [{ clause: clauseAddressSchema.parse("CD-14#class-syntax"), sight: { kind: "one-symptom", symptom: CLASS_DECLARED } }],
    checks: [],
    namedBans: [],
  },
};

const UNREAD_GUIDE: SymptomGuide = {
  guide: "unreadable",
  failure: "file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end",
};

describe("guidedCheckCommandOutcome", () => {
  it("exits 0 and prints the report when the verdict is pass", () => {
    expect(
      guidedCheckCommandOutcome({
        result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, guide: NO_SYMPTOM_GUIDE } },
      }),
    ).toEqual({ code: 0, text: "verdict: pass\n" });
  });

  it("exits 1 and names each finding's symptom from the guide, with the symptom's note in readFirst", () => {
    expect(
      guidedCheckCommandOutcome({
        result: {
          outcome: "ok",
          value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, guide: CLASS_GUIDE },
        },
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {} symptom: class-declared, may indicate: doer-or-orchestrator\nreadFirst (1)\nclass-declared: Class declared. May indicate: keeps state or settings across calls → Doer or orchestrator. The breach usually sits in the unit that holds state. Known debt: debt (today: file-carve-out). Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#class-declared\nverdict: fail\n",
    });
  });

  it("exits 1 for findings when the catalogue was not read, saying so in readFirst", () => {
    expect(
      guidedCheckCommandOutcome({
        result: {
          outcome: "ok",
          value: { report: { ...EMPTY_REPORT, findings: [CLASS_IN_A] }, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, guide: UNREAD_GUIDE },
        },
      }),
    ).toEqual({
      code: 1,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nreadFirst (1)\nsymptom catalogue not read, so no finding names its symptom: file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end\nverdict: fail\n",
    });
  });

  it("exits 0 for a clean report when the catalogue was not read, saying so in readFirst", () => {
    expect(
      guidedCheckCommandOutcome({
        result: { outcome: "ok", value: { report: EMPTY_REPORT, output: "full", projectCommand: PROJECT_COMMAND, pruneCommand: PRUNE_COMMAND, guide: UNREAD_GUIDE } },
      }),
    ).toEqual({
      code: 0,
      text: "readFirst (1)\nsymptom catalogue not read, so no finding names its symptom: file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end\nverdict: pass\n",
    });
  });

  it("exits 2 and prints the load failure line when an input could not be loaded", () => {
    expect(
      guidedCheckCommandOutcome({
        result: { outcome: "failed", error: { kind: "file-malformed", path: "/repo/rules/typescript/symptoms.json", detail: "Unexpected end" } },
      }),
    ).toEqual({ code: 2, text: "load failure: file-malformed /repo/rules/typescript/symptoms.json Unexpected end\n" });
  });
});
