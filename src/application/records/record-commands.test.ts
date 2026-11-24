import { describe, expect, it, vi } from "vitest";

import type { CheckFinding, NamedGovernedRun } from "../../domain/finding/governance.ts";
import type {
  Case,
  Check,
  Engine,
  Principle,
  RecordKind,
  Recipe,
  Rule,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type {
  PlacedRecord,
  RecordsDocument,
  RecordsDocumentRefusal,
  RefusedRecord,
  SymptomReach,
} from "../../domain/records/hone-records/hone-record.ts";
import type { RecordsEdit } from "../../domain/records/hone-records/records-edit.ts";
import type { WhyChain } from "../../domain/records/why-chain.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { TouchedSet } from "../../domain/repository/touched-set.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import type { AuthoriseRequest } from "../ports/authorising.ts";
import type { RecordsEditor } from "../ports/records/records-editor.ts";
import type { RecordsReader } from "../ports/records/records-reader.ts";
import type { RecordsSource } from "../ports/records/records-source.ts";
import type { RecordsStore } from "../ports/records/records-store.ts";
import {
  authoriseOf,
  pruneDebtOf,
  type RecordDebtRequest,
  recordDebtOf,
} from "./record-commands.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const CLOCK_SOURCES = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-17"),
  clause: clauseIdOf("clock-sources"),
};

const CAST_EXPRESSIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const TESTS_ARE_OURS: Principle = { name: "tests-are-ours", title: "Tests are ours" };

const AT_A_BOUNDARY: Principle = {
  name: "external-behaviour-sits-at-a-boundary",
  title: "External behaviour sits at a boundary",
};

const ONE_PLACE_DECIDES: Principle = { name: "one-place-decides", title: "One place decides" };

const PORTS_DECLARED_INSIDE: Rule = {
  name: "ports-declared-inside",
  title: "Ports declared inside",
  principle: AT_A_BOUNDARY,
  standing: "accepted",
};

const WRITTEN_OUT_ANSWERS: Rule = {
  name: "written-out-answers",
  title: "Written-out answers",
  principle: TESTS_ARE_OURS,
  standing: "accepted",
};

const DOER_OR_ORCHESTRATOR: Rule = {
  name: "doer-or-orchestrator",
  title: "Doer or orchestrator",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: ONE_PLACE_DECIDES,
  standing: "accepted",
};

const NEEDS_THE_CURRENT_TIME: Case = {
  name: "needs-the-current-time-a-random-value-a-new-id-or-an-outside-ordering",
  title: "Needs the current time, a random value, a new id or an outside ordering",
  standing: "accepted",
  owes: [{ kind: "principle", principle: AT_A_BOUNDARY }],
};

const DOES_ONE_JOB: Case = {
  name: "does-one-job",
  title: "Does one job",
  standing: "accepted",
  owes: [{ kind: "principle", principle: ONE_PLACE_DECIDES }],
};

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
};

const WORLD_VALUES_THROUGH_A_PORT: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "world-values-through-a-port",
  title: "World values through a port",
  standing: "accepted",
  reason: { text: "the world reaches a unit through a port", standing: "accepted" },
};

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DATE_USED_DIRECTLY: Symptom = {
  ruleSet: TOOL_RULE_SET,
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
  correctUses: [
    {
      situation: "correct use",
      kind: AUTHORISED_LOCATION,
      at: "on the clock adapter",
      binding: "check-and-file",
    },
  ],
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [
    {
      case: GIVES_A_VALUE_ITS_TYPE,
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [
    { situation: "a schema proves the type", kind: AUTHORISED_LOCATION, binding: "check-and-file" },
  ],
};

const CLOCK_CHECK: Check = {
  name: "clock-sources",
  symptom: DATE_USED_DIRECTLY,
  page: "date-used-directly/clock-sources.md",
  clause: CLOCK_SOURCES,
  engines: [WALKER],
  forms: [],
  findingSpecifics: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [TESTS_ARE_OURS, AT_A_BOUNDARY, ONE_PLACE_DECIDES],
  rules: [PORTS_DECLARED_INSIDE, WRITTEN_OUT_ANSWERS, DOER_OR_ORCHESTRATOR, DECLARED_NOT_ASSERTED],
  cases: [NEEDS_THE_CURRENT_TIME, DOES_ONE_JOB, GIVES_A_VALUE_ITS_TYPE],
  recipes: [WORLD_VALUES_THROUGH_A_PORT],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [DATE_USED_DIRECTLY, CLAIMED_TYPE],
  clauses: [
    { clause: CLOCK_SOURCES, sight: { kind: "one-symptom", symptom: DATE_USED_DIRECTLY } },
    { clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } },
  ],
  checks: [CLOCK_CHECK, CAST_CHECK],
  namedBans: [],
};

const ORDER_FILE = repoPathOf("src/orders/charge-order.ts");

const NEW_FILE = repoPathOf("src/orders/refund-order.ts");

const TOUCHED_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const DEBT_FILE = repoPathOf("hone-records/debt/date-used-directly.json");

const WEBHOOK_DEBT_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const AUTHORISED_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const RECORDS_FOLDER = repoPathOf("hone-records");

const CLOCK_FINDING: CheckFinding = {
  check: "date-used-directly#clock-sources",
  mechanism: AUDIT,
  file: ORDER_FILE,
  anchor: { line: 14, column: 0 },
  snippet: "chargedAt",
};

const UNCATALOGUED_FINDING: CheckFinding = {
  ...CLOCK_FINDING,
  check: "unknown-symptom#nowhere",
};

const NEW_FILE_FINDING: CheckFinding = { ...CLOCK_FINDING, file: NEW_FILE };

const TOUCHED_FINDING: CheckFinding = {
  check: "claimed-type#cast-expressions",
  mechanism: ESLINT,
  file: TOUCHED_FILE,
  anchor: { line: 4, column: 9 },
  snippet: "body as Event",
};

const OK = { outcome: "ok", value: undefined } as const;

const CLOCK_DEBT_ENTRY = { answers: "date-used-directly#clock-sources", file: ORDER_FILE };

const WEBHOOK_DEBT_ENTRY = { answers: "claimed-type#cast-expressions", file: TOUCHED_FILE };

const DEBT_DOCUMENT: RecordsDocument = {
  file: DEBT_FILE,
  document: { version: 2, records: [CLOCK_DEBT_ENTRY] },
};

const WEBHOOK_DEBT_DOCUMENT: RecordsDocument = {
  file: WEBHOOK_DEBT_FILE,
  document: { version: 2, records: [WEBHOOK_DEBT_ENTRY] },
};

const HELD_CLOCK_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: {
    kind: "debt",
    symptom: DATE_USED_DIRECTLY,
    reach: { reaches: "one-check", check: CLOCK_CHECK },
    file: ORDER_FILE,
    holding: { held: "stated" },
  },
};

const NOT_A_RECORDS_DOCUMENT: readonly RecordsDocumentRefusal[] = [
  {
    kind: "document-refused",
    file: DEBT_FILE,
    issues: [{ path: ["version"], message: "Invalid input: expected 2" }],
  },
];

const sourceOf = (request: {
  readonly documents: readonly RecordsDocument[];
}): Pick<RecordsSource, "read"> => ({
  read: vi.fn<RecordsSource["read"]>().mockReturnValue({ outcome: "ok", value: request.documents }),
});

const storeOf = () => {
  const apply = vi.fn<RecordsStore["apply"]>().mockReturnValue(OK);
  return { apply, store: { apply } };
};

const readerRefusing = (request: {
  readonly refused: readonly RefusedRecord[];
}): Pick<RecordsReader, "recordsReadingOf"> => ({
  recordsReadingOf: vi.fn<RecordsReader["recordsReadingOf"]>().mockReturnValue({
    outcome: "ok",
    value: {
      records: [],
      refused: request.refused,
      notes: [],
      base: { measured: "no", base: { state: "not-given" } },
    },
  }),
});

const readerHolding = (request: {
  readonly records: readonly PlacedRecord[];
}): Pick<RecordsReader, "recordsReadingOf"> => ({
  recordsReadingOf: vi.fn<RecordsReader["recordsReadingOf"]>().mockReturnValue({
    outcome: "ok",
    value: {
      records: request.records,
      refused: [],
      notes: [],
      base: { measured: "no", base: { state: "not-given" } },
    },
  }),
});

const READER_HOLDING_NOTHING = readerHolding({ records: [] });

const editorAdding = (request: {
  readonly added: readonly RecordsDocument[];
}): Pick<RecordsEditor, "documentsWithAdded" | "documentsWithRepointed" | "placeOfAddition"> => ({
  documentsWithAdded: vi
    .fn<RecordsEditor["documentsWithAdded"]>()
    .mockReturnValue({ outcome: "ok", value: request.added }),
  documentsWithRepointed: vi
    .fn<RecordsEditor["documentsWithRepointed"]>()
    .mockReturnValue({ outcome: "ok", value: [] }),
  placeOfAddition: vi
    .fn<RecordsEditor["placeOfAddition"]>()
    .mockReturnValue({ file: AUTHORISED_FILE, index: 0 }),
});

const editorRemoving = (request: {
  readonly edit: RecordsEdit;
}): Pick<RecordsEditor, "documentsWithRemoved"> => ({
  documentsWithRemoved: vi
    .fn<RecordsEditor["documentsWithRemoved"]>()
    .mockReturnValue({ outcome: "ok", value: request.edit }),
});

const NOTHING_CHANGED: TouchedSet = { measured: "yes", paths: new Set() };

const NEW_AND_WEBHOOK_CHANGED: TouchedSet = {
  measured: "yes",
  paths: new Set([TOUCHED_FILE, NEW_FILE]),
};

const LEFT_TO_ANOTHER_RUN: TouchedSet = { measured: "elsewhere" };

const UNMEASURED: TouchedSet = {
  measured: "no",
  base: { state: "git-failed", revision: "origin/main", gitMessage: "bad revision" },
};

describe("hone record-debt over a run's unanswered findings", () => {
  const walkerRun: NamedGovernedRun = {
    mechanism: AUDIT,
    nativeExceptions: [],
    coverableKinds: [],
    nestedConfigurations: [],
    unprojectedFolders: [],
  };
  const request: RecordDebtRequest = {
    findings: [CLOCK_FINDING],
    unrecorded: [],
    runs: [walkerRun, { ...walkerRun, mechanism: ESLINT }],
    touched: NOTHING_CHANGED,
    moved: [],
    leave: [],
  };

  it("reports a missing engine run without asking the records editor to write debt", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorAdding({ added: [] });
    expect(
      recordDebtOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: READER_HOLDING_NOTHING,
          recordsEditor,
          source: sourceOf({ documents: [] }),
          store,
        },
        run: { ...request, runs: [] },
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          address: "date-used-directly#clock-sources",
          file: ORDER_FILE,
          effect: "unrecordable",
          because: { kind: "no-run" },
        },
      ],
    });
    expect(recordsEditor.documentsWithAdded).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes one debt record under hone-records/debt for the symptom and check, as the editor adds it", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorAdding({ added: [DEBT_DOCUMENT] });
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor,
        source: sourceOf({ documents: [] }),
        store,
      },
      run: request,
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: TOOL_RULE_SET,
          address: "date-used-directly#clock-sources",
          file: ORDER_FILE,
          effect: "recorded",
        },
      ],
    });
    expect(recordsEditor.documentsWithAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [],
        additions: [{ file: DEBT_FILE, entry: CLOCK_DEBT_ENTRY }],
      }),
    );
    expect(apply).toHaveBeenCalledWith({ edit: { write: [DEBT_DOCUMENT], remove: [] } });
  });

  it("repoints each record the run found held at a moved path, writing the repointed document, with no finding to record", () => {
    const { apply, store } = storeOf();
    const moved = repoPathOf("src/charges/charge-order.ts");
    const repointedDocument: RecordsDocument = {
      file: DEBT_FILE,
      document: { version: 2, records: [{ ...CLOCK_DEBT_ENTRY, file: moved }] },
    };
    const recordsEditor = {
      ...editorAdding({ added: [] }),
      documentsWithRepointed: vi
        .fn<RecordsEditor["documentsWithRepointed"]>()
        .mockReturnValue({ outcome: "ok", value: [repointedDocument] }),
    };
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerHolding({ records: [HELD_CLOCK_DEBT] }),
        recordsEditor,
        source: sourceOf({ documents: [DEBT_DOCUMENT] }),
        store,
      },
      run: {
        ...request,
        findings: [],
        moved: [{ place: HELD_CLOCK_DEBT.place, file: moved }],
      },
    });
    expect({
      recorded,
      repointed: recordsEditor.documentsWithRepointed.mock.calls,
      added: vi.mocked(recordsEditor.documentsWithAdded).mock.calls,
      stored: apply.mock.calls,
    }).toEqual({
      recorded: { outcome: "ok", value: [] },
      repointed: [
        [
          {
            documents: [DEBT_DOCUMENT],
            repointings: [{ place: HELD_CLOCK_DEBT.place, file: moved }],
          },
        ],
      ],
      added: [[{ documents: [repointedDocument], additions: [] }]],
      stored: [[{ edit: { write: [repointedDocument], remove: [] } }]],
    });
  });

  it("fails with the records-folder failure when the symptom's name cannot name a records file", () => {
    const unnameable: Symptom = { ...DATE_USED_DIRECTLY, name: "Not A Name" };
    const recordsEditor = editorAdding({ added: [] });
    const recorded = recordDebtOf({
      ports: {
        catalogue: {
          ...REPORT_CATALOGUE,
          symptoms: [unnameable, CLAIMED_TYPE],
          checks: [{ ...CLOCK_CHECK, symptom: unnameable }, CAST_CHECK],
        },
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor,
        source: sourceOf({ documents: [] }),
        store: storeOf().store,
      },
      run: { ...request, findings: [{ ...CLOCK_FINDING, check: "Not A Name#clock-sources" }] },
    });
    expect(recorded).toEqual({
      outcome: "failed",
      error: {
        kind: "records-folder",
        failure: { kind: "not-a-records-name", folder: "hone-records/debt", name: "Not A Name" },
      },
    });
  });

  it("writes a team check's debt under its rule set's debt folder", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamSymptom: Symptom = { ...DATE_USED_DIRECTLY, ruleSet: acme };
    const recordsEditor = editorAdding({ added: [] });
    const recorded = recordDebtOf({
      ports: {
        catalogue: {
          ...REPORT_CATALOGUE,
          symptoms: [teamSymptom, CLAIMED_TYPE],
          checks: [{ ...CLOCK_CHECK, symptom: teamSymptom }, CAST_CHECK],
        },
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor,
        source: sourceOf({ documents: [] }),
        store: storeOf().store,
      },
      run: request,
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: acme,
          address: "date-used-directly#clock-sources",
          file: ORDER_FILE,
          effect: "recorded",
        },
      ],
    });
    expect(recordsEditor.documentsWithAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        additions: [
          { file: "hone-records/acme/debt/date-used-directly.json", entry: CLOCK_DEBT_ENTRY },
        ],
      }),
    );
  });

  it("prints a nested configuration result without writing debt the projection cannot apply", () => {
    const { apply, store } = storeOf();
    const folder = repoPathOf("src/orders");
    const unprojected = { folder, selectionFolder: repoPathOf("src") };
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor: editorAdding({ added: [] }),
        source: sourceOf({ documents: [] }),
        store,
      },
      run: {
        ...request,
        runs: [
          {
            mechanism: CLOCK_FINDING.mechanism,
            nativeExceptions: [],
            coverableKinds: [],
            nestedConfigurations: [unprojected.selectionFolder],
            unprojectedFolders: [unprojected],
          },
        ],
      },
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: TOOL_RULE_SET,
          address: CLOCK_FINDING.check,
          file: ORDER_FILE,
          effect: "nested-configuration",
          mechanism: CLOCK_FINDING.mechanism,
          ...unprojected,
        },
      ],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("reads the held records from the source's documents, against the catalogue and no base", () => {
    const { store } = storeOf();
    const recordsReader = readerHolding({ records: [HELD_CLOCK_DEBT] });
    recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader,
        recordsEditor: editorAdding({ added: [] }),
        source: sourceOf({ documents: [DEBT_DOCUMENT] }),
        store,
      },
      run: request,
    });
    expect(recordsReader.recordsReadingOf).toHaveBeenCalledWith({
      documents: [DEBT_DOCUMENT],
      catalogue: REPORT_CATALOGUE,
      base: { measured: "no", base: { state: "not-given" } },
    });
  });

  it("writes nothing the second time, when the first run's records are held", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerHolding({ records: [HELD_CLOCK_DEBT] }),
        recordsEditor: editorAdding({ added: [] }),
        source: sourceOf({ documents: [DEBT_DOCUMENT] }),
        store,
      },
      run: request,
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: TOOL_RULE_SET,
          address: "date-used-directly#clock-sources",
          file: ORDER_FILE,
          effect: "already-recorded",
          heldIn: DEBT_FILE,
        },
      ],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("declines debt on a file the change created or changed when this run assesses forfeiture, as the check forfeits the same debt", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor: editorAdding({ added: [] }),
        source: sourceOf({ documents: [] }),
        store,
      },
      run: {
        ...request,
        findings: [NEW_FILE_FINDING, TOUCHED_FINDING],
        touched: NEW_AND_WEBHOOK_CHANGED,
      },
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: TOOL_RULE_SET,
          address: "claimed-type#cast-expressions",
          file: TOUCHED_FILE,
          effect: "touched",
          of: "finding",
        },
        {
          ruleSet: TOOL_RULE_SET,
          address: "date-used-directly#clock-sources",
          file: NEW_FILE,
          effect: "touched",
          of: "finding",
        },
      ],
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes debt on a file the change changed when another run assesses forfeiture, as the check answers the finding by it", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorAdding({ added: [WEBHOOK_DEBT_DOCUMENT] });
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor,
        source: sourceOf({ documents: [] }),
        store,
      },
      run: { ...request, findings: [TOUCHED_FINDING], touched: LEFT_TO_ANOTHER_RUN },
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: TOOL_RULE_SET,
          address: "claimed-type#cast-expressions",
          file: TOUCHED_FILE,
          effect: "recorded",
        },
      ],
    });
    expect(recordsEditor.documentsWithAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [],
        additions: [{ file: WEBHOOK_DEBT_FILE, entry: WEBHOOK_DEBT_ENTRY }],
      }),
    );
    expect(apply).toHaveBeenCalledWith({ edit: { write: [WEBHOOK_DEBT_DOCUMENT], remove: [] } });
  });

  it("gives a line to a finding it cannot record debt for, and records the others", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorAdding({ added: [DEBT_DOCUMENT] });
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_HOLDING_NOTHING,
        recordsEditor,
        source: sourceOf({ documents: [] }),
        store,
      },
      run: { ...request, findings: [UNCATALOGUED_FINDING, CLOCK_FINDING] },
    });
    expect(recorded).toEqual({
      outcome: "ok",
      value: [
        {
          ruleSet: TOOL_RULE_SET,
          address: "date-used-directly#clock-sources",
          file: ORDER_FILE,
          effect: "recorded",
        },
        {
          address: "unknown-symptom#nowhere",
          file: ORDER_FILE,
          effect: "unrecordable",
          because: { kind: "no-check" },
        },
      ],
    });
    expect(recordsEditor.documentsWithAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [],
        additions: [{ file: DEBT_FILE, entry: CLOCK_DEBT_ENTRY }],
      }),
    );
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when every finding is one it cannot record debt for", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorAdding({ added: [] });
    expect(
      recordDebtOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: READER_HOLDING_NOTHING,
          recordsEditor,
          source: sourceOf({ documents: [] }),
          store,
        },
        run: { ...request, findings: [UNCATALOGUED_FINDING] },
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          address: "unknown-symptom#nowhere",
          file: ORDER_FILE,
          effect: "unrecordable",
          because: { kind: "no-check" },
        },
      ],
    });
    expect(recordsEditor.documentsWithAdded).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing, reads nothing and prints nothing when the run left nothing unanswered", () => {
    const { apply, store } = storeOf();
    const source = sourceOf({ documents: [] });
    expect(
      recordDebtOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: READER_HOLDING_NOTHING,
          recordsEditor: editorAdding({ added: [] }),
          source,
          store,
        },
        run: { ...request, findings: [] },
      }),
    ).toEqual({ outcome: "ok", value: [] });
    expect(source.read).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails with git's own words when the run could not measure the change", () => {
    const { apply, store } = storeOf();
    expect(
      recordDebtOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: READER_HOLDING_NOTHING,
          recordsEditor: editorAdding({ added: [] }),
          source: sourceOf({ documents: [] }),
          store,
        },
        run: { ...request, touched: UNMEASURED },
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", detail: "bad revision" },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails, without writing, when hone-records holds a file it cannot read as records", () => {
    const { apply, store } = storeOf();
    const recorded = recordDebtOf({
      ports: {
        catalogue: REPORT_CATALOGUE,
        recordsReader: {
          recordsReadingOf: vi
            .fn<RecordsReader["recordsReadingOf"]>()
            .mockReturnValue({ outcome: "failed", error: NOT_A_RECORDS_DOCUMENT }),
        },
        recordsEditor: editorAdding({ added: [] }),
        source: sourceOf({ documents: [{ file: DEBT_FILE, document: { records: [] } }] }),
        store,
      },
      run: request,
    });
    expect(recorded).toEqual({
      outcome: "failed",
      error: { kind: "records-documents", refusals: NOT_A_RECORDS_DOCUMENT },
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("passes on the failure of the store that could not write", () => {
    const { apply, store } = storeOf();
    apply.mockReturnValue({
      outcome: "failed",
      error: {
        kind: "file-unwritable",
        path: "/work/shop/hone-records/debt/date-used-directly.json",
        detail: "EACCES",
      },
    });
    expect(
      recordDebtOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: READER_HOLDING_NOTHING,
          recordsEditor: editorAdding({ added: [DEBT_DOCUMENT] }),
          source: sourceOf({ documents: [] }),
          store,
        },
        run: request,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unwritable",
        path: "/work/shop/hone-records/debt/date-used-directly.json",
        detail: "EACCES",
      },
    });
  });
});

const PAID_DEBT: PlacedRecord = {
  place: { file: DEBT_FILE, index: 0 },
  record: {
    kind: "debt",
    symptom: DATE_USED_DIRECTLY,
    reach: WHOLE_SYMPTOM,
    file: ORDER_FILE,
    holding: { held: "stated" },
  },
};

describe("hone prune-debt over a run's paid, stale and forfeited debt", () => {
  it("removes exactly the debt the report listed, from the document that holds it", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorRemoving({ edit: { write: [], remove: [DEBT_FILE] } });
    const pruned = pruneDebtOf({
      ports: { recordsEditor, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store },
      report: { paid: [{ debt: PAID_DEBT, answeredBy: [] }], stale: [], forfeited: [] },
    });
    expect(pruned).toMatchObject({
      outcome: "ok",
      value: [{ place: { file: DEBT_FILE, index: 0 }, reason: "paid" }],
    });
    expect(recordsEditor.documentsWithRemoved).toHaveBeenCalledWith({
      documents: [DEBT_DOCUMENT],
      places: [{ file: DEBT_FILE, index: 0 }],
    });
    expect(apply).toHaveBeenCalledWith({ edit: { write: [], remove: [DEBT_FILE] } });
  });

  it("writes nothing when the report lists nothing to remove", () => {
    const { apply, store } = storeOf();
    const recordsEditor = editorRemoving({ edit: { write: [], remove: [] } });
    expect(
      pruneDebtOf({
        ports: { recordsEditor, source: sourceOf({ documents: [DEBT_DOCUMENT] }), store },
        report: { paid: [], stale: [], forfeited: [] },
      }),
    ).toEqual({ outcome: "ok", value: [] });
    expect(recordsEditor.documentsWithRemoved).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});

const AUTHORISE: AuthoriseRequest = {
  answers: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
  file: TOUCHED_FILE,
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: AUTHORISED_FILE,
  document: {
    version: 2,
    records: [
      {
        answers: "claimed-type",
        file: TOUCHED_FILE,
        case: "gives-a-value-its-type",
        owes: "declared-not-asserted",
        whyChain: {
          whys: CAUSAL_WHY_CHAIN.whys,
          rootCause: CAUSAL_WHY_CHAIN.rootCause,
          rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
          readback: CAUSAL_WHY_CHAIN.readback,
          owner: CAUSAL_WHY_CHAIN.owner,
        },
      },
    ],
  },
};

describe("hone authorise over the person's arguments", () => {
  it("writes the one record when the reading accepts it", () => {
    const { apply, store } = storeOf();
    expect(
      authoriseOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: READER_HOLDING_NOTHING,
          recordsEditor: editorAdding({ added: [AUTHORISED_DOCUMENT] }),
          source: sourceOf({ documents: [] }),
          store,
        },
        request: AUTHORISE,
      }),
    ).toEqual({
      outcome: "ok",
      value: { judged: "accepted", edit: { write: [AUTHORISED_DOCUMENT], remove: [] } },
    });
    expect(apply).toHaveBeenCalledWith({ edit: { write: [AUTHORISED_DOCUMENT], remove: [] } });
  });

  it("writes nothing when the reading refuses the chain", () => {
    const { apply, store } = storeOf();
    expect(
      authoriseOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: readerRefusing({
            refused: [
              {
                place: { file: AUTHORISED_FILE, index: 0 },
                refusals: [
                  {
                    kind: "form-refused",
                    issues: [{ path: ["whyChain", "rootCause"], message: "too short" }],
                  },
                ],
              },
            ],
          }),
          recordsEditor: editorAdding({ added: [AUTHORISED_DOCUMENT] }),
          source: sourceOf({ documents: [] }),
          store,
        },
        request: { ...AUTHORISE, rootCause: "no" },
      }),
    ).toMatchObject({ outcome: "ok", value: { judged: "refused" } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("writes nothing for a record already held", () => {
    const { apply, store } = storeOf();
    expect(
      authoriseOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader: readerRefusing({
            refused: [
              {
                place: { file: AUTHORISED_FILE, index: 0 },
                refusals: [{ kind: "duplicate", of: { file: AUTHORISED_FILE, index: 1 } }],
              },
            ],
          }),
          recordsEditor: editorAdding({ added: [AUTHORISED_DOCUMENT] }),
          source: sourceOf({ documents: [AUTHORISED_DOCUMENT] }),
          store,
        },
        request: AUTHORISE,
      }),
    ).toEqual({ outcome: "ok", value: { judged: "already-held", heldIn: AUTHORISED_FILE } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("fails, without reading, when the records folder cannot be read", () => {
    const { apply, store } = storeOf();
    const recordsReader = readerHolding({ records: [] });
    expect(
      authoriseOf({
        ports: {
          catalogue: REPORT_CATALOGUE,
          recordsReader,
          recordsEditor: editorAdding({ added: [AUTHORISED_DOCUMENT] }),
          source: {
            read: vi.fn<RecordsSource["read"]>().mockReturnValue({
              outcome: "failed",
              error: {
                kind: "records-folder-unreadable",
                folder: RECORDS_FOLDER,
                detail: "EACCES",
              },
            }),
          },
          store,
        },
        request: AUTHORISE,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "records-folder",
        failure: { kind: "records-folder-unreadable", folder: RECORDS_FOLDER, detail: "EACCES" },
      },
    });
    expect(recordsReader.recordsReadingOf).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});
