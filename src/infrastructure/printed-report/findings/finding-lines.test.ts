import { describe, expect, it } from "vitest";
import {
  AUDIT,
  CAST_CHECK,
  CAST_EXPRESSIONS,
  CHECKS_PAGE,
  CLAIMED_TYPE,
  CLOCK_CHECK,
  CLOCK_SOURCES,
  ESLINT,
  ESLINT_ENGINE,
  REPORT_CATALOGUE,
  TEAM_CLAUSE,
  TEST_BODY_CHECK,
  TEST_BODY_LOGIC,
  WHOLE_SYMPTOM,
} from "../../../../tests/report-catalogue.ts";
import type { AttributedNativeException, Finding } from "../../command-line/governance.ts";
import type { PlacedRecord } from "../../hone-records-folder/hone-record.ts";
import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { editionSchema } from "../../content-files/edition.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { answeredLine, checkLine, editionLine, findingLine, notRunLine, unrecordedLines } from "./finding-lines.ts";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const TEST_FILE = repoPathSchema.parse("src/orders/charge-order.test.ts");

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const PACKAGE_FILE = repoPathSchema.parse("package.json");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "const chargedAt = clock.now();" };

const BRANCH_FINDING: Finding = {
  clause: TEST_BODY_LOGIC,
  mechanism: AUDIT,
  file: TEST_FILE,
  anchor: { line: 22, column: 2 },
  snippet: "if (result.ok) {\n  return;",
  remedy: { fix: "write one test per case, or one it.each table", page: CHECKS_PAGE, section: "branching-with-if" },
};

const SECOND_CAST_CHECK: Check = { name: "cast-walker", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const TEAM_FINDING: Finding = { clause: TEAM_CLAUSE, mechanism: ESLINT, file: ORDER_FILE, anchor: { line: 1, column: 0 }, snippet: "moment()" };

const DEBT: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: 0 },
  record: { kind: "debt", symptom: CLAIMED_TYPE, reach: WHOLE_SYMPTOM, file: WEBHOOK_FILE, holding: { held: "stated" } },
};

const CLOCK_BOUNDARY: PlacedRecord = {
  place: { file: repoPathSchema.parse("hone-records/boundary-records.json"), index: 0 },
  record: { kind: "boundary-record", module: ORDER_FILE, outsideParty: { kind: "runtime", facility: "clock" }, holding: { held: "stated", ports: ["Clock"] } },
};

describe("findingLine", () => {
  it("leads with the check address and engine, then the place, the snippet and what the symptom may indicate", () => {
    expect(findingLine({ catalogue: REPORT_CATALOGUE, finding: CLOCK_FINDING })).toBe(
      "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator",
    );
  });

  it("ends with the fix and the page that shows it when the check names one, and keeps a line break in the snippet on one line", () => {
    expect(findingLine({ catalogue: REPORT_CATALOGUE, finding: BRANCH_FINDING })).toBe(
      `branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; may indicate: straight-through-tests, no-hidden-effects fix: write one test per case, or one it.each table (${CHECKS_PAGE}#branching-with-if)`,
    );
  });

  it("leads with the clause address and mechanism when the catalogue has no check for the finding, and names no symptom", () => {
    expect(findingLine({ catalogue: REPORT_CATALOGUE, finding: TEAM_FINDING })).toBe("acme/AC-1#no-moment eslint src/orders/charge-order.ts:1:0 moment()");
  });
});

describe("answeredLine", () => {
  it("names each record that answers the finding, by its kind, after the finding's place and snippet", () => {
    expect(answeredLine({ catalogue: REPORT_CATALOGUE, answered: { finding: CLOCK_FINDING, by: [DEBT, CLOCK_BOUNDARY] } })).toBe(
      "date-used-directly#clock-sources walker src/orders/charge-order.ts:14:0 const chargedAt = clock.now(); answered by debt answered by boundary-record runtime:clock",
    );
  });

  it("names neither the symptom's indications nor the fix", () => {
    expect(answeredLine({ catalogue: REPORT_CATALOGUE, answered: { finding: BRANCH_FINDING, by: [DEBT] } })).toBe(
      "branch-in-a-test#test-body walker src/orders/charge-order.test.ts:22:2 if (result.ok) {\\n  return; answered by debt",
    );
  });
});

describe("the lines that name a check", () => {
  it("prints an edition by its check, engine, the edition that ran and the latest", () => {
    expect(editionLine({ reading: { check: CLOCK_CHECK, engine: { name: "walker", mechanism: AUDIT }, edition: editionSchema.parse("2"), latest: editionSchema.parse("3") } })).toBe(
      "date-used-directly#clock-sources walker edition 2 of 3",
    );
  });

  it("prints a check by its address", () => {
    expect(checkLine({ check: TEST_BODY_CHECK })).toBe("branch-in-a-test#test-body");
  });

  it("prints a check that is adopted and not run as enforced by review", () => {
    expect(notRunLine({ check: TEST_BODY_CHECK })).toBe("branch-in-a-test#test-body adopted, engine not run: enforced by review");
  });
});

describe("unrecordedLines", () => {
  it.each<{ readonly name: string; readonly exception: AttributedNativeException; readonly line: string }>([
    { name: "an ignore", exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT }, line: "claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts" },
    {
      name: "a config override",
      exception: { kind: "config-override", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint config-override src/adapters/stripe-webhook.ts",
    },
    {
      name: "a suppression entry",
      exception: { kind: "suppression-entry", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, location: repoPathSchema.parse("eslint-suppressions.json"), mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint suppression-entry src/adapters/stripe-webhook.ts eslint-suppressions.json",
    },
    {
      name: "an inline disable of one rule",
      exception: { kind: "inline-disable", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 4, text: "// eslint-disable-next-line no-restricted-syntax", reach: "one-clause", mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:4 // eslint-disable-next-line no-restricted-syntax",
    },
    {
      name: "an inline disable that names no rule",
      exception: { kind: "inline-disable", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 4, text: "// eslint-disable-next-line", reach: "every-selected-clause", mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint inline-disable src/adapters/stripe-webhook.ts:4 // eslint-disable-next-line names no rule and escapes every selected check: naming the rule is the cheap fix",
    },
    {
      name: "an inline rule config",
      exception: { kind: "inline-rule-config", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, line: 1, text: "/* eslint no-restricted-syntax: off */", mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint inline-rule-config src/adapters/stripe-webhook.ts:1 /* eslint no-restricted-syntax: off */",
    },
    {
      name: "a command-line option that weakens the whole run",
      exception: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "--no-inline-config", cause: { kind: "weakens-run" }, mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint command-line-option package.json lint --no-inline-config weakens the script's whole run, so no record can cover it: remove it from the script",
    },
    {
      name: "a command-line option after another command",
      exception: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: { kind: "after-another-command", command: "eslint", invocation: "eslint --rule x:off ." },
        mechanism: ESLINT,
      },
      line: 'claimed-type#cast-expressions eslint command-line-option package.json lint --rule x:off: eslint is not the first command of its script, so Hone cannot tell what the option does to the files under check; give eslint a script of its own, such as "eslint --rule x:off ."',
    },
    {
      name: "a wrapped command-line option",
      exception: {
        kind: "command-line-option",
        clause: CAST_EXPRESSIONS,
        location: PACKAGE_FILE,
        script: "lint",
        option: "--rule x:off",
        cause: { kind: "wrapped", command: "eslint", wrapper: "env" },
        mechanism: ESLINT,
      },
      line: 'claimed-type#cast-expressions eslint command-line-option package.json lint --rule x:off: "env" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint',
    },
    {
      name: "a command-line option in a script Hone cannot read",
      exception: { kind: "command-line-option", clause: CAST_EXPRESSIONS, location: PACKAGE_FILE, script: "lint", option: "eslint 'x", cause: { kind: "unreadable", command: "eslint" }, mechanism: ESLINT },
      line: "claimed-type#cast-expressions eslint command-line-option package.json lint eslint 'x: a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check; pair every quote in the script",
    },
  ])("prints $name led by the check it suppresses", ({ exception, line }) => {
    expect(unrecordedLines({ catalogue: REPORT_CATALOGUE, exception })).toEqual([line]);
  });

  it("prints a suppression of a clause the catalogue has no check for, led by its clause and mechanism", () => {
    expect(unrecordedLines({ catalogue: REPORT_CATALOGUE, exception: { kind: "ignore", clause: TEAM_CLAUSE, file: ORDER_FILE, mechanism: ESLINT } })).toEqual([
      "acme/AC-1#no-moment eslint ignore src/orders/charge-order.ts",
    ]);
  });

  it("prints one line for each check of the suppressed clause on that engine", () => {
    expect(
      unrecordedLines({
        catalogue: { ...REPORT_CATALOGUE, checks: [CAST_CHECK, SECOND_CAST_CHECK] },
        exception: { kind: "ignore", clause: CAST_EXPRESSIONS, file: WEBHOOK_FILE, mechanism: ESLINT },
      }),
    ).toEqual(["claimed-type#cast-expressions eslint ignore src/adapters/stripe-webhook.ts", "claimed-type#cast-walker eslint ignore src/adapters/stripe-webhook.ts"]);
  });
});
