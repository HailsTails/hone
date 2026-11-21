import { describe, expect, it } from "vitest";
import { DATE_USED_DIRECTLY, WHOLE_SYMPTOM } from "../../../../tests/report-catalogue.ts";
import type { Authorising } from "../../../application/records/authorising.ts";
import type { DebtOutcome } from "../../../domain/records/debt/debt-effects.ts";
import type { Debt } from "../../hone-records-folder/hone-record.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { authorisingLines, debtOutcomeLine, projectNextLine, prunedDebtLine } from "./record-command-lines.ts";

const FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const RECORDS_FILE = repoPathSchema.parse("hone-records/debt/date-used-directly.json");

const SITE = { address: "date-used-directly#clock-sources", file: FILE } as const;

const OUTCOME_LINES: readonly (readonly [DebtOutcome, string])[] = [
  [{ ...SITE, effect: "recorded" }, "date-used-directly#clock-sources recorded src/orders/charge-order.ts"],
  [
    { ...SITE, effect: "already-recorded", heldIn: RECORDS_FILE },
    "date-used-directly#clock-sources already-recorded src/orders/charge-order.ts: hone-records/debt/date-used-directly.json already holds debt on this symptom and file; the check says why it does not answer",
  ],
  [
    { ...SITE, effect: "left", under: repoPathSchema.parse("src/orders") },
    "date-used-directly#clock-sources left src/orders/charge-order.ts: under --leave src/orders; record it as an authorised location with its own reason, or fix it",
  ],
  [
    { ...SITE, effect: "touched", of: "finding" },
    "date-used-directly#clock-sources touched src/orders/charge-order.ts: this change created or changed the file, so this run would forfeit debt on it; fix the finding there",
  ],
  [
    { ...SITE, effect: "touched", of: "native-exception" },
    "date-used-directly#clock-sources touched src/orders/charge-order.ts: this change created or changed the file, so this run would forfeit debt on it; fix what the comment hides, then remove the comment",
  ],
  [
    { address: "CD-99#nowhere", file: FILE, effect: "unrecordable", because: { kind: "no-check" } },
    "CD-99#nowhere unrecordable src/orders/charge-order.ts: the catalogue gives this finding no symptom or check to record debt against; fix the finding",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "ignore" } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "inline-rule-config" } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "suppression-entry" } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "weakens-run" } } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: a lint-script option weakens the script's whole run, so no record can cover it; remove it from the script",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "after-another-command", command: "eslint", invocation: "eslint --rule x:off ." } } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: eslint is not the first command of its script, so Hone cannot tell what the option does to the files under check; give eslint a script of its own, such as \"eslint --rule x:off .\"",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "wrapped", command: "eslint", wrapper: "time" } } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: \"time\" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "unreadable", command: "eslint" } } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check; pair every quote in the script",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "config-override" } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it",
  ],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "inline-disable" } },
    "date-used-directly#clock-sources unrecordable src/orders/charge-order.ts: no record of this engine holds this comment; fix the code, or remove the comment",
  ],
];

const DEBT: Debt = { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: FILE, holding: { held: "stated" } };

const PLACE = { file: RECORDS_FILE, index: 0 };

describe("the lines hone record-debt prints", () => {
  it.each(OUTCOME_LINES)("prints %j as one line", (outcome, line) => {
    expect(debtOutcomeLine({ outcome })).toBe(line);
  });
});

describe("the line hone record-debt prints after the debt it recorded", () => {
  it("names the command that puts the recorded debt into effect", () => {
    expect(projectNextLine({ projectCommand: "node hone.ts project --repo ." })).toBe("run node hone.ts project --repo . to put the recorded debt into effect");
  });
});

describe("the lines hone prune-debt prints", () => {
  it("prints each debt it removed with the reason the report listed it for", () => {
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "paid" } })).toBe("date-used-directly removed src/orders/charge-order.ts: paid");
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "credited-nothing" } })).toBe("date-used-directly removed src/orders/charge-order.ts: stale");
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "file-gone" } })).toBe("date-used-directly removed src/orders/charge-order.ts: stale, its file is no longer in the repository");
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "file-excluded" } })).toBe("date-used-directly removed src/orders/charge-order.ts: stale, its file is excluded by the settings");
    expect(prunedDebtLine({ pruned: { place: PLACE, debt: DEBT, reason: "forfeited" } })).toBe("date-used-directly removed src/orders/charge-order.ts: forfeited");
  });
});

describe("the lines hone authorise prints", () => {
  const AUTHORISE = { address: "claimed-type#cast-expressions", file: FILE };

  it("prints one line for a record it wrote", () => {
    const accepted: Authorising = { judged: "accepted", edit: { write: [], remove: [] } };
    expect(authorisingLines({ ...AUTHORISE, authorising: accepted })).toEqual(["claimed-type#cast-expressions authorised src/orders/charge-order.ts"]);
  });

  it("prints one line for a record already held, and where", () => {
    expect(authorisingLines({ ...AUTHORISE, authorising: { judged: "already-held", heldIn: RECORDS_FILE } })).toEqual([
      "claimed-type#cast-expressions already-authorised src/orders/charge-order.ts: hone-records/debt/date-used-directly.json already holds this record",
    ]);
  });

  it("prints one line for each reason it refused", () => {
    expect(
      authorisingLines({
        ...AUTHORISE,
        authorising: { judged: "refused", refusals: [{ kind: "unknown-symptom", symptom: "no-such-symptom" }, { kind: "not-a-records-name", name: "Not A Name" }] },
      }),
    ).toEqual([
      'claimed-type#cast-expressions refused src/orders/charge-order.ts: unknown-symptom "no-such-symptom"',
      'claimed-type#cast-expressions refused src/orders/charge-order.ts: not-a-records-name "Not A Name"',
    ]);
  });
});
