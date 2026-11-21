import { describe, expect, it } from "vitest";
import type { PrintedLine } from "./output-contract.ts";
import { RECORD_COMMAND_LINES } from "./printable-record-command-lines.ts";

const ADDRESS = "date-used-directly#clock-sources";

const FILE = "src/orders/charge-order.ts";

const HELD_IN = "hone-records/debt/date-used-directly.json";

const PRUNED_ADDRESS = "date-used-directly";

const RECORD_DEBT_EFFECT_LINES: readonly PrintedLine[] = [
  { label: "record-debt", text: `${ADDRESS} recorded ${FILE}`, fills: { address: ADDRESS, file: FILE } },
  {
    label: "record-debt",
    text: `${ADDRESS} already-recorded ${FILE}: ${HELD_IN} already holds debt on this symptom and file; the check says why it does not answer`,
    fills: { address: ADDRESS, file: FILE, "records file": HELD_IN },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} left ${FILE}: under --leave src/orders; record it as an authorised location with its own reason, or fix it`,
    fills: { address: ADDRESS, file: FILE, path: "src/orders" },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} touched ${FILE}: this change created or changed the file, so this run would forfeit debt on it; fix the finding there`,
    fills: { address: ADDRESS, file: FILE },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} touched ${FILE}: this change created or changed the file, so this run would forfeit debt on it; fix what the comment hides, then remove the comment`,
    fills: { address: ADDRESS, file: FILE },
  },
];

const PROJECT_NEXT_LINE: PrintedLine = {
  label: "record-debt",
  text: "run node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop to put the recorded debt into effect",
  fills: { "project command": "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop" },
};

const UNRECORDABLE_LINES: readonly PrintedLine[] = [
  {
    label: "record-debt",
    text: `CD-99#nowhere unrecordable ${FILE}: the catalogue gives this finding no symptom or check to record debt against; fix the finding`,
    fills: { address: ADDRESS, file: FILE, clause: "CD-99#nowhere" },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree`,
    fills: { address: ADDRESS, file: FILE },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment`,
    fills: { address: ADDRESS, file: FILE },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file`,
    fills: { address: ADDRESS, file: FILE },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: a lint-script option weakens the script's whole run, so no record can cover it; remove it from the script`,
    fills: { address: ADDRESS, file: FILE },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: eslint is not the first command of its script, so Hone cannot tell what the option does to the files under check; give eslint a script of its own, such as "eslint --rule x:off ."`,
    fills: { address: ADDRESS, file: FILE, command: "eslint", invocation: '"eslint --rule x:off ."' },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: "env" comes before eslint and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before eslint`,
    fills: { address: ADDRESS, file: FILE, command: "eslint", wrapper: '"env"' },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check; pair every quote in the script`,
    fills: { address: ADDRESS, file: FILE, command: "eslint" },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it`,
    fills: { address: ADDRESS, file: FILE },
  },
  {
    label: "record-debt",
    text: `${ADDRESS} unrecordable ${FILE}: no record of this engine holds this comment; fix the code, or remove the comment`,
    fills: { address: ADDRESS, file: FILE },
  },
];

const PRUNE_DEBT_LINES: readonly PrintedLine[] = [
  { label: "prune-debt", text: `${PRUNED_ADDRESS} removed ${FILE}: paid`, fills: { address: PRUNED_ADDRESS, file: FILE } },
  { label: "prune-debt", text: `${PRUNED_ADDRESS} removed ${FILE}: stale`, fills: { address: PRUNED_ADDRESS, file: FILE } },
  { label: "prune-debt", text: `${PRUNED_ADDRESS} removed ${FILE}: stale, its file is no longer in the repository`, fills: { address: PRUNED_ADDRESS, file: FILE } },
  { label: "prune-debt", text: `${PRUNED_ADDRESS} removed ${FILE}: stale, its file is excluded by the settings`, fills: { address: PRUNED_ADDRESS, file: FILE } },
  { label: "prune-debt", text: `${PRUNED_ADDRESS} removed ${FILE}: forfeited`, fills: { address: PRUNED_ADDRESS, file: FILE } },
];

const AUTHORISE_LINES: readonly PrintedLine[] = [
  { label: "authorise", text: `${ADDRESS} authorised ${FILE}`, fills: { address: ADDRESS, file: FILE } },
  {
    label: "authorise",
    text: `${ADDRESS} already-authorised ${FILE}: ${HELD_IN} already holds this record`,
    fills: { address: ADDRESS, file: FILE, "records file": HELD_IN },
  },
  { label: "authorise", text: `${ADDRESS} refused ${FILE}: unknown-symptom "no-such-symptom"`, fills: { address: ADDRESS, file: FILE, given: "no-such-symptom" } },
  { label: "authorise", text: `${ADDRESS} refused ${FILE}: not-a-records-name "Not A Name"`, fills: { address: ADDRESS, file: FILE, given: "Not A Name" } },
  {
    label: "authorise",
    text: `${ADDRESS} refused ${FILE}: form-refused whyChain.rootCause: \`whyChain.rootCause\` is required: the fifth why names the cause, not another symptom`,
    fills: {
      address: ADDRESS,
      file: FILE,
      path: "whyChain.rootCause",
      message: "`whyChain.rootCause` is required: the fifth why names the cause, not another symptom",
    },
  },
];

describe("every line the version 2 record commands can print, as the contract is read against", () => {
  it("holds a line for each effect of record-debt, each reason prune-debt removes for, and each result of authorise", () => {
    expect(RECORD_COMMAND_LINES).toEqual([...RECORD_DEBT_EFFECT_LINES, ...UNRECORDABLE_LINES, PROJECT_NEXT_LINE, ...PRUNE_DEBT_LINES, ...AUTHORISE_LINES]);
  });
});
