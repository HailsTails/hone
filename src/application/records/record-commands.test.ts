import { assert, describe, expect, it, vi } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../../tests/causal-why-chain.ts";
import { AUDIT, CAST_EXPRESSIONS, CLOCK_SOURCES, DATE_USED_DIRECTLY, ESLINT, REPORT_CATALOGUE, WHOLE_SYMPTOM } from "../../../tests/report-catalogue.ts";
import type { Finding } from "../../infrastructure/command-line/governance.ts";
import { answerFindings } from "../../domain/records/answering/answering.ts";
import type { TouchedSet } from "../run/touched-set/touched-set.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { PlacedRecord, RecordsDocument } from "../../infrastructure/hone-records-folder/hone-record.ts";
import { authoriseOf, pruneDebtOf, type RecordDebtRequest, recordDebtOf } from "./record-commands.ts";
import { recordsReadingOf } from "../../infrastructure/hone-records-folder/reading/records-reading.ts";
import type { RecordsSource } from "../ports/records-source.ts";
import type { RecordsStore } from "../../infrastructure/hone-records-folder/writing/records-store.ts";

const ORDER_FILE = repoPathSchema.parse("src/orders/charge-order.ts");

const NEW_FILE = repoPathSchema.parse("src/orders/refund-order.ts");

const TOUCHED_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const DEBT_FILE = repoPathSchema.parse("hone-records/debt/date-used-directly.json");

const CLOCK_FINDING: Finding = { clause: CLOCK_SOURCES, mechanism: AUDIT, file: ORDER_FILE, anchor: { line: 14, column: 0 }, snippet: "chargedAt" };

const UNCATALOGUED_FINDING: Finding = { ...CLOCK_FINDING, clause: clauseAddressSchema.parse("CD-99#nowhere") };

const NEW_FILE_FINDING: Finding = { ...CLOCK_FINDING, file: NEW_FILE };

const TOUCHED_FINDING: Finding = { clause: CAST_EXPRESSIONS, mechanism: ESLINT, file: TOUCHED_FILE, anchor: { line: 4, column: 9 }, snippet: "body as Event" };

const OK = { outcome: "ok", value: undefined } as const;

const DEBT_DOCUMENT: RecordsDocument = {
  file: DEBT_FILE,
  document: { version: 2, records: [{ answers: "date-used-directly#clock-sources", file: ORDER_FILE }] },
};

const sourceOf = (request: { readonly documents: readonly RecordsDocument[] }): RecordsSource => ({
  read: () => ({ outcome: "ok", value: request.documents }),
  readAt: () => ({ outcome: "ok", value: [] }),
});

const storeOf = () => {
  const apply = vi.fn<RecordsStore["apply"]>().mockReturnValue(OK);
  return { apply, store: { apply } };
};

const NOTHING_CHANGED: TouchedSet = { measured: "yes", paths: new Set() };

const NEW_AND_WEBHOOK_CHANGED: TouchedSet = { measured: "yes", paths: new Set([TOUCHED_FILE, NEW_FILE]) };

const LEFT_TO_ANOTHER_RUN: TouchedSet = { measured: "elsewhere" };

const UNMEASURED: TouchedSet = { measured: "no", base: { state: "git-failed", revision: "origin/main", gitMessage: "bad revision" } };

const COMMAND = { catalogue: REPORT_CATALOGUE };
const WEBHOOK_DEBT_DOCUMENT: RecordsDocument = {
  file: repoPathSchema.parse("hone-records/debt/claimed-type.json"),
  document: { version: 2, records: [{ answers: "claimed-type#cast-expressions", file: TOUCHED_FILE }] },
};

const answeredFor = (request: { readonly documents: readonly RecordsDocument[]; readonly touched: TouchedSet; readonly finding: Finding }) => {
  const reading = recordsReadingOf({ documents: request.documents, catalogue: REPORT_CATALOGUE, base: { measured: "no", base: { state: "not-given" } } });
  assert(reading.outcome === "ok", "the records read");
  return answerFindings({
    catalogue: REPORT_CATALOGUE,
    records: reading.value.records,
    findings: [{ finding: request.finding, party: { reported: "not-reported" } }],
    touched: request.touched,
    runs: [], measurements: { runs: [], tracked: [], excluded: [] },
  });
};

describe("hone record-debt over a run's unanswered findings", () => {
  const request: RecordDebtRequest = { findings: [CLOCK_FINDING], unrecorded: [], runs: [], touched: NOTHING_CHANGED, leave: [] };

  it("writes one debt record under hone-records/debt for the symptom and check, in the format the records reader reads", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })(request);
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "recorded" }] });
    expect(apply).toHaveBeenCalledWith({
      edit: { write: [{ file: DEBT_FILE, document: { version: 2, records: [{ answers: "date-used-directly#clock-sources", file: ORDER_FILE }] } }], remove: [] },
    });
  });

  it("writes nothing the second time, when the first run's records are held", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store })(request);
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE }] });
    expect(apply).not.toHaveBeenCalled();
  });

  it("declines debt on a file the change created or changed when this run assesses forfeiture, as the check forfeits the same debt", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })({
      ...request,
      findings: [NEW_FILE_FINDING, TOUCHED_FINDING],
      touched: NEW_AND_WEBHOOK_CHANGED,
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        { address: "claimed-type#cast-expressions", file: TOUCHED_FILE, effect: "touched", of: "finding" },
        { address: "date-used-directly#clock-sources", file: NEW_FILE, effect: "touched", of: "finding" },
      ],
    });
    expect(apply).not.toHaveBeenCalled();
    const checked = answeredFor({ documents: [WEBHOOK_DEBT_DOCUMENT], touched: NEW_AND_WEBHOOK_CHANGED, finding: TOUCHED_FINDING });
    expect(checked).toMatchObject({ findings: [TOUCHED_FINDING], answered: [], forfeited: [{ place: { file: WEBHOOK_DEBT_DOCUMENT.file, index: 0 } }] });
  });

  it("writes debt on a file the change changed when another run assesses forfeiture, as the check answers the finding by it", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })({
      ...request,
      findings: [TOUCHED_FINDING],
      touched: LEFT_TO_ANOTHER_RUN,
    });
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "claimed-type#cast-expressions", file: TOUCHED_FILE, effect: "recorded" }] });
    const [written] = apply.mock.calls;
    assert(written !== undefined, "the debt was written");
    const checked = answeredFor({ documents: written[0].edit.write, touched: LEFT_TO_ANOTHER_RUN, finding: TOUCHED_FINDING });
    expect(checked).toMatchObject({ findings: [], answered: [{ finding: TOUCHED_FINDING }], forfeited: [] });
  });

  it("gives a line to a finding it cannot record debt for, and records the others", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })({ ...request, findings: [UNCATALOGUED_FINDING, CLOCK_FINDING] });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        { address: "CD-99#nowhere", file: ORDER_FILE, effect: "unrecordable", because: { kind: "no-check" } },
        { address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "recorded" },
      ],
    });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when every finding is one it cannot record debt for", () => {
    const { apply, store } = storeOf();
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })({ ...request, findings: [UNCATALOGUED_FINDING] })).toEqual({
      outcome: "ok",
      value: [{ address: "CD-99#nowhere", file: ORDER_FILE, effect: "unrecordable", because: { kind: "no-check" } }],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing and prints nothing when the run left nothing unanswered", () => {
    const { apply, store } = storeOf();
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })({ ...request, findings: [] })).toEqual({ outcome: "ok", value: [] });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails with git's own words when the run could not measure the change", () => {
    const { apply, store } = storeOf();
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })({ ...request, touched: UNMEASURED })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "bad revision" },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails, without writing, when hone-records holds a file it cannot read as records", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({
      ...COMMAND,
      source: sourceOf({ documents: [{ file: DEBT_FILE, document: { records: [] } }] }),
      store,
    })(request);
    expect(recorded).toMatchObject({ outcome: "failed", error: { kind: "records-documents" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("passes on the failure of the store that could not write", () => {
    const { apply, store } = storeOf();
    apply.mockReturnValue({ outcome: "failed", error: { kind: "file-unwritable", path: "/work/shop/hone-records/debt/date-used-directly.json", detail: "EACCES" } });
    expect(recordDebtOf({ ...COMMAND, source: sourceOf({ documents: [] }), store })(request)).toEqual({
      outcome: "failed",
      error: { kind: "file-unwritable", path: "/work/shop/hone-records/debt/date-used-directly.json", detail: "EACCES" },
    });
  });
});

const PAID_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: { kind: "debt", symptom: DATE_USED_DIRECTLY, reach: WHOLE_SYMPTOM, file: ORDER_FILE, holding: { held: "stated" } },
};

describe("hone prune-debt over a run's paid, stale and forfeited debt", () => {
  it("removes exactly the debt the report listed, from the document that holds it", () => {
    const { apply, store } = storeOf();
    const pruned = pruneDebtOf({ source: sourceOf({ documents: [DEBT_DOCUMENT] }), store })({ report: { paid: [{ debt: PAID_DEBT, answeredBy: [] }], stale: [], forfeited: [] } });
    expect(pruned).toMatchObject({ outcome: "ok", value: [{ place: { file: DEBT_FILE, index: 0 }, reason: "paid" }] });
    expect(apply).toHaveBeenCalledWith({ edit: { write: [], remove: [DEBT_FILE] } });
  });

  it("writes nothing when the report lists nothing to remove", () => {
    const { apply, store } = storeOf();
    expect(pruneDebtOf({ source: sourceOf({ documents: [DEBT_DOCUMENT] }), store })({ report: { paid: [], stale: [], forfeited: [] } })).toEqual({ outcome: "ok", value: [] });
    expect(apply).not.toHaveBeenCalled();
  });
});

const AUTHORISE = {
  answers: "claimed-type",
  file: TOUCHED_FILE,
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

describe("hone authorise over the person's arguments", () => {
  it("writes the one record when the form accepts it", () => {
    const { apply, store } = storeOf();
    expect(authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: [] }), store })(AUTHORISE)).toMatchObject({ outcome: "ok", value: { judged: "accepted" } });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the form refuses the chain", () => {
    const { apply, store } = storeOf();
    expect(authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: [] }), store })({ ...AUTHORISE, rootCause: "no" })).toMatchObject({ outcome: "ok", value: { judged: "refused" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing for a record already held", () => {
    const first = storeOf();
    authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: [] }), store: first.store })(AUTHORISE);
    const { apply, store } = storeOf();
    const [firstCall] = first.apply.mock.calls;
    assert(firstCall !== undefined, "the first authorise wrote its record");
    expect(authoriseOf({ catalogue: REPORT_CATALOGUE, source: sourceOf({ documents: firstCall[0].edit.write }), store })(AUTHORISE)).toMatchObject({ outcome: "ok", value: { judged: "already-held" } });
    expect(apply).not.toHaveBeenCalled();
  });
});
