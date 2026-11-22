import { assert, describe, expect, it, vi } from "vitest";
import type { Finding } from "../domain/finding/governance.ts";
import { answerFindings } from "../domain/records/answering/answering.ts";
import type { Case, Check, Engine, Principle, RecordKind, Recipe, Rule, Symptom, SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { TouchedSet } from "../domain/repository/touched-set.ts";
import { clauseAddressSchema } from "../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../infrastructure/hone-records-folder/repo-path.ts";
import type { PlacedRecord, RecordsDocument, SymptomReach } from "../domain/records/hone-records/hone-record.ts";
import type { WhyChain } from "../domain/records/why-chain.ts";
import { authoriseOf, pruneDebtOf, type RecordDebtRequest, recordDebtOf } from "../application/records/record-commands.ts";
import { recordsReader, recordsReadingOf } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "../infrastructure/hone-records-folder/writing/records-edit.ts";
import type { RecordsSource } from "../application/ports/records/records-source.ts";
import type { RecordsStore } from "../application/ports/records/records-store.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = { name: "external-behaviour-sits-at-a-boundary", title: "External behaviour sits at a boundary" };

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const PORTS_DECLARED_INSIDE: Rule = { name: "ports-declared-inside", title: "Ports declared inside", principle: AT_A_BOUNDARY, standing: "accepted" };

const WRITTEN_OUT_ANSWERS: Rule = { name: "written-out-answers", title: "Written-out answers", principle: TESTS_ARE_OURS, standing: "accepted" };

const DOER_OR_ORCHESTRATOR: Rule = { name: "doer-or-orchestrator", title: "Doer or orchestrator", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const DECLARED_NOT_ASSERTED: Rule = { name: "declared-not-asserted", title: "Declared, not asserted", principle: ONE_PLACE_DECIDES, standing: "accepted" };

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = { name: "does-one-job", title: "Does one job", standing: "accepted", owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }] };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const BOUNDARY_RECORD: RecordKind = { name: "boundary-record", title: "Boundary record", phrase: "a boundary record", todaysFormat: "authorised-location" };

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of `Date` outside the places that handle dates.",
  mayIndicate: [
    {
      case: NEEDS_THE_CURRENT_TIME,
      points: [
        { kind: "rule", rule: PORTS_DECLARED_INSIDE },
        { kind: "rule", rule: WRITTEN_OUT_ANSWERS },
      ],
    },
    { case: DOES_ONE_JOB, points: [{ kind: "rule", rule: DOER_OR_ORCHESTRATOR }] },
  ],
  breachUsuallySits: "in the unit that should be passed the time, often a doer doing two jobs",
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  correctUses: [{ situation: "correct use", kind: BOUNDARY_RECORD, at: "on the clock adapter" }],
};

const CLAIMED_TYPE: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [{ case: GIVES_A_VALUE_ITS_TYPE, situation: "or needs it narrower", points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }] }],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION }],
};

const CLOCK_CHECK: Check = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, engines: [WALKER], forms: [] };

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  recordKinds: [AUTHORISED_LOCATION, BOUNDARY_RECORD, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, CAST_CHECK],
  namedBans: [],
};

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

const COMMAND = { catalogue: REPORT_CATALOGUE, recordsReader, recordsEditor };
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
    const recorded = recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: request });
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "recorded" }] });
    expect(apply).toHaveBeenCalledWith({
      edit: { write: [{ file: DEBT_FILE, document: { version: 2, records: [{ answers: "date-used-directly#clock-sources", file: ORDER_FILE }] } }], remove: [] },
    });
  });

  it("writes nothing the second time, when the first run's records are held", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store }, run: request });
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "date-used-directly#clock-sources", file: ORDER_FILE, effect: "already-recorded", heldIn: DEBT_FILE }] });
    expect(apply).not.toHaveBeenCalled();
  });

  it("declines debt on a file the change created or changed when this run assesses forfeiture, as the check forfeits the same debt", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: {
      ...request,
      findings: [NEW_FILE_FINDING, TOUCHED_FINDING],
      touched: NEW_AND_WEBHOOK_CHANGED,
    } });
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
    const recorded = recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: {
      ...request,
      findings: [TOUCHED_FINDING],
      touched: LEFT_TO_ANOTHER_RUN,
    } });
    expect(recorded).toEqual({ outcome: "ok", value: [{ address: "claimed-type#cast-expressions", file: TOUCHED_FILE, effect: "recorded" }] });
    const [written] = apply.mock.calls;
    assert(written !== undefined, "the debt was written");
    const checked = answeredFor({ documents: written[0].edit.write, touched: LEFT_TO_ANOTHER_RUN, finding: TOUCHED_FINDING });
    expect(checked).toMatchObject({ findings: [], answered: [{ finding: TOUCHED_FINDING }], forfeited: [] });
  });

  it("gives a line to a finding it cannot record debt for, and records the others", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: { ...request, findings: [UNCATALOGUED_FINDING, CLOCK_FINDING] } });
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
    expect(recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: { ...request, findings: [UNCATALOGUED_FINDING] } })).toEqual({
      outcome: "ok",
      value: [{ address: "CD-99#nowhere", file: ORDER_FILE, effect: "unrecordable", because: { kind: "no-check" } }],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing and prints nothing when the run left nothing unanswered", () => {
    const { apply, store } = storeOf();
    expect(recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: { ...request, findings: [] } })).toEqual({ outcome: "ok", value: [] });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails with git's own words when the run could not measure the change", () => {
    const { apply, store } = storeOf();
    expect(recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: { ...request, touched: UNMEASURED } })).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "bad revision" },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails, without writing, when hone-records holds a file it cannot read as records", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({ ports: {
      ...COMMAND,
      source: sourceOf({ documents: [{ file: DEBT_FILE, document: { records: [] } }] }),
      store,
    }, run: request });
    expect(recorded).toMatchObject({ outcome: "failed", error: { kind: "records-documents" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("passes on the failure of the store that could not write", () => {
    const { apply, store } = storeOf();
    apply.mockReturnValue({ outcome: "failed", error: { kind: "file-unwritable", path: "/work/shop/hone-records/debt/date-used-directly.json", detail: "EACCES" } });
    expect(recordDebtOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, run: request })).toEqual({
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
    const pruned = pruneDebtOf({ ports: { recordsEditor, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store }, report: { paid: [{ debt: PAID_DEBT, answeredBy: [] }], stale: [], forfeited: [] } });
    expect(pruned).toMatchObject({ outcome: "ok", value: [{ place: { file: DEBT_FILE, index: 0 }, reason: "paid" }] });
    expect(apply).toHaveBeenCalledWith({ edit: { write: [], remove: [DEBT_FILE] } });
  });

  it("writes nothing when the report lists nothing to remove", () => {
    const { apply, store } = storeOf();
    expect(pruneDebtOf({ ports: { recordsEditor, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store }, report: { paid: [], stale: [], forfeited: [] } })).toEqual({ outcome: "ok", value: [] });
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
    expect(authoriseOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, request: AUTHORISE })).toMatchObject({ outcome: "ok", value: { judged: "accepted" } });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the form refuses the chain", () => {
    const { apply, store } = storeOf();
    expect(authoriseOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store }, request: { ...AUTHORISE, rootCause: "no" } })).toMatchObject({ outcome: "ok", value: { judged: "refused" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing for a record already held", () => {
    const first = storeOf();
    authoriseOf({ ports: { ...COMMAND, source: sourceOf({ documents: [] }), store: first.store }, request: AUTHORISE });
    const { apply, store } = storeOf();
    const [firstCall] = first.apply.mock.calls;
    assert(firstCall !== undefined, "the first authorise wrote its record");
    expect(authoriseOf({ ports: { ...COMMAND, source: sourceOf({ documents: firstCall[0].edit.write }), store }, request: AUTHORISE })).toMatchObject({ outcome: "ok", value: { judged: "already-held" } });
    expect(apply).not.toHaveBeenCalled();
  });
});
