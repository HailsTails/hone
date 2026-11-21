import { type AuthoriseRequest, type Authorising, authorisingOf } from "../src/application/records/authorising.ts";
import type { DebtOutcome } from "../src/domain/records/debt/debt-effects.ts";
import type { Debt, RecordRefusal } from "../src/infrastructure/hone-records-folder/hone-record.ts";
import type { PrunedReason } from "../src/domain/records/debt/prunable-debt.ts";
import { authorisingLines, debtOutcomeLine, projectNextLine, prunedDebtLine } from "../src/infrastructure/printed-report/records/record-command-lines.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";
import type { PrintedLine } from "./output-contract.ts";
import { CAUSAL_WHY_CHAIN } from "./causal-why-chain.ts";
import { DATE_USED_DIRECTLY, REPORT_CATALOGUE, WHOLE_SYMPTOM } from "./report-catalogue.ts";

const FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const RECORDS_FILE = repoPathSchema.parse("hone-records/debt/date-used-directly.json");

const ADDRESS = "date-used-directly#clock-sources";

const SITE = { address: ADDRESS, file: FILE } as const;

const LEFT_UNDER = repoPathSchema.parse("src/orders");

const DEBT: Debt = { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: FILE, holding: { held: "stated" } };

const OUTCOMES: readonly (readonly [DebtOutcome, Readonly<Record<string, string>>])[] = [
  [{ ...SITE, effect: "recorded" }, {}],
  [{ ...SITE, effect: "already-recorded", heldIn: RECORDS_FILE }, { "records file": RECORDS_FILE }],
  [{ ...SITE, effect: "left", under: LEFT_UNDER }, { path: LEFT_UNDER }],
  [{ ...SITE, effect: "touched", of: "finding" }, {}],
  [{ ...SITE, effect: "touched", of: "native-exception" }, {}],
  [{ address: "CD-99#nowhere", file: FILE, effect: "unrecordable", because: { kind: "no-check" } }, { clause: "CD-99#nowhere" }],
  [{ ...SITE, effect: "unrecordable", because: { kind: "ignore" } }, {}],
  [{ ...SITE, effect: "unrecordable", because: { kind: "inline-rule-config" } }, {}],
  [{ ...SITE, effect: "unrecordable", because: { kind: "suppression-entry" } }, {}],
  [{ ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "weakens-run" } } }, {}],
  [
    { ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "after-another-command", command: "eslint", invocation: "eslint --rule x:off ." } } },
    { command: "eslint", invocation: '"eslint --rule x:off ."' },
  ],
  [{ ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "wrapped", command: "eslint", wrapper: "env" } } }, { command: "eslint", wrapper: '"env"' }],
  [{ ...SITE, effect: "unrecordable", because: { kind: "command-line-option", cause: { kind: "unreadable", command: "eslint" } } }, { command: "eslint" }],
  [{ ...SITE, effect: "unrecordable", because: { kind: "config-override" } }, {}],
  [{ ...SITE, effect: "unrecordable", because: { kind: "inline-disable" } }, {}],
];

const PRUNED_REASONS: readonly PrunedReason[] = ["paid", "credited-nothing", "file-gone", "file-excluded", "forfeited"];

const AUTHORISINGS: readonly (readonly [Authorising, Readonly<Record<string, string>>])[] = [
  [{ judged: "accepted", edit: { write: [], remove: [] } }, {}],
  [{ judged: "already-held", heldIn: RECORDS_FILE }, { "records file": RECORDS_FILE }],
];

const REFUSALS: readonly (readonly [RecordRefusal, Readonly<Record<string, string>>])[] = [
  [{ kind: "unknown-symptom", symptom: "no-such-symptom" }, { given: "no-such-symptom" }],
  [{ kind: "not-a-records-name", name: "Not A Name" }, { given: "Not A Name" }],
];

const ADDRESS_FILE = { address: ADDRESS, file: FILE };

const MISTAKEN_CHAIN: AuthoriseRequest = {
  answers: "claimed-type",
  file: FILE,
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: "no",
  rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

const formRefusalSample = (): readonly (readonly [RecordRefusal, Readonly<Record<string, string>>])[] => {
  const judged = authorisingOf({ request: MISTAKEN_CHAIN, documents: [], catalogue: REPORT_CATALOGUE });
  if (judged.outcome === "failed" || judged.value.judged !== "refused") {
    return [];
  }
  return judged.value.refusals.flatMap((refusal) =>
    refusal.kind === "form-refused" ? refusal.issues.map((issue): readonly [RecordRefusal, Readonly<Record<string, string>>] => [{ kind: "form-refused", issues: [issue] }, { path: issue.path.join("."), message: issue.message }]) : [],
  );
};

const PROJECT_COMMAND = "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

export const RECORD_COMMAND_LINES: readonly PrintedLine[] = [
  ...OUTCOMES.map(([outcome, fills]): PrintedLine => ({ label: "record-debt", text: debtOutcomeLine({ outcome }), fills: { file: FILE, address: ADDRESS, ...fills } })),
  { label: "record-debt", text: projectNextLine({ projectCommand: PROJECT_COMMAND }), fills: { "project command": PROJECT_COMMAND } },
  ...PRUNED_REASONS.map((reason): PrintedLine => ({ label: "prune-debt", text: prunedDebtLine({ pruned: { place: { file: RECORDS_FILE, index: 0 }, debt: DEBT, reason } }), fills: { address: "date-used-directly", file: FILE } })),
  ...AUTHORISINGS.flatMap(([authorising, fills]) =>
    authorisingLines({ ...ADDRESS_FILE, authorising }).map((text): PrintedLine => ({ label: "authorise", text, fills: { address: ADDRESS, file: FILE, ...fills } })),
  ),
  ...[...REFUSALS, ...formRefusalSample()].flatMap(([refusal, fills]) =>
    authorisingLines({ ...ADDRESS_FILE, authorising: { judged: "refused", refusals: [refusal] } }).map((text): PrintedLine => ({ label: "authorise", text, fills: { address: ADDRESS, file: FILE, ...fills } })),
  ),
];
