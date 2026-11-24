import { describe, expect, it, vi } from "vitest";

import type { FoundTreeExceptions } from "../../application/ports/records/exception-repository.ts";
import type { RecordsSource } from "../../application/ports/records/records-source.ts";
import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type { RecordsDocument } from "../../domain/records/hone-records/hone-record.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { foundTreeRecordsSourceOver } from "./found-tree-records-source.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: "hone",
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { form: "a-for-loop", symptom: LOOP_KEYWORD },
          { form: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const ENTRY = {
  kind: "authorised-location",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "kept",
} as const;

const FOUND_TREE = "the tree the upgrade found";

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: repoPathOf("hone-records/authorised-locations/loop-keyword.json"),
  document: {
    version: 2,
    records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: ENTRY }],
  },
};

const WRITTEN_DOCUMENT: RecordsDocument = {
  file: repoPathOf("hone-records/debt/loop-keyword.json"),
  document: { version: 2, records: [] },
};

const entriesAtFoundTree = (): FoundTreeExceptions => ({
  readAt: vi.fn<FoundTreeExceptions["readAt"]>().mockReturnValue({ outcome: "ok", value: [ENTRY] }),
});

const sourceReading = (): RecordsSource => ({
  read: vi
    .fn<RecordsSource["read"]>()
    .mockReturnValue({ outcome: "ok", value: [WRITTEN_DOCUMENT] }),
  readAt: vi.fn<RecordsSource["readAt"]>(),
});

describe("foundTreeRecordsSourceOver", () => {
  it("reads the records the working tree holds as they are", () => {
    const source = foundTreeRecordsSourceOver({
      source: sourceReading(),
      exceptions: entriesAtFoundTree(),
      catalogue: SETTINGS_CATALOGUE,
    });
    expect(source.read()).toEqual({ outcome: "ok", value: [WRITTEN_DOCUMENT] });
  });

  it("holds at the base the records the version 1 entries at the found tree become, and asks the records folder for nothing at the base", () => {
    const underlying = sourceReading();
    const exceptions = entriesAtFoundTree();
    const source = foundTreeRecordsSourceOver({
      source: underlying,
      exceptions,
      catalogue: SETTINGS_CATALOGUE,
    });
    expect({
      atBase: source.readAt({ revision: FOUND_TREE }),
      askedRecords: vi.mocked(underlying.readAt).mock.calls,
      askedEntries: vi.mocked(exceptions.readAt).mock.calls,
    }).toEqual({
      atBase: { outcome: "ok", value: [AUTHORISED_DOCUMENT] },
      askedRecords: [],
      askedEntries: [[{ revision: FOUND_TREE }]],
    });
  });
});
