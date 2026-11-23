import { describe, expect, it, vi } from "vitest";

import type {
  Check,
  Engine,
  RecordKind,
  Rule,
  Symptom,
  SymptomCatalogue,
} from "../../domain/language-layer/symptom-catalogue.ts";
import type {
  RecordPlace,
  RecordRefusal,
  RecordsDocument,
  RecordsDocumentRefusal,
} from "../../domain/records/hone-records/hone-record.ts";
import type { WhyChain } from "../../domain/records/why-chain.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import type { AuthoriseRequest } from "../ports/authorising.ts";
import type { RecordsEditFailure, RecordsEditor } from "../ports/records/records-editor.ts";
import type { RecordsReader } from "../ports/records/records-reader.ts";
import { authorisingOf } from "./authorising.ts";

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

const CAST_EXPRESSIONS = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const ESLINT_ENGINE: Engine = { name: "eslint" };

const DECLARED_NOT_ASSERTED: Rule = {
  name: "declared-not-asserted",
  title: "Declared, not asserted",
  principle: { name: "one-place-decides", title: "One place decides" },
  standing: "accepted",
};

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

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
        owes: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
      },
      situation: "or needs it narrower",
      points: [{ kind: "rule", rule: DECLARED_NOT_ASSERTED }],
    },
  ],
  breachUsuallySits: "at the producer",
  recipes: [],
  correctUses: [{ situation: "a schema proves the type", kind: AUTHORISED_LOCATION }],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: CAST_EXPRESSIONS,
  engines: [ESLINT_ENGINE],
  forms: [],
};

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [{ name: "one-place-decides", title: "One place decides" }],
  rules: [DECLARED_NOT_ASSERTED],
  cases: [CLAIMED_TYPE.mayIndicate[0].case],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [ESLINT_ENGINE],
  symptoms: [CLAIMED_TYPE],
  clauses: [{ clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } }],
  checks: [CAST_CHECK],
  namedBans: [],
};

const WEBHOOK_FILE = repoPathOf("src/adapters/stripe-webhook.ts");

const OTHER_FILE = repoPathOf("src/adapters/other-webhook.ts");

const RECORDS_FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const UNRELATED_RECORDS_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const REQUEST: AuthoriseRequest = {
  answers: "claimed-type",
  file: WEBHOOK_FILE,
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

const WEBHOOK_ENTRY = {
  answers: "claimed-type",
  file: WEBHOOK_FILE,
  case: "gives-a-value-its-type",
  owes: "declared-not-asserted",
  whyChain: {
    whys: CAUSAL_WHY_CHAIN.whys,
    rootCause: CAUSAL_WHY_CHAIN.rootCause,
    rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
    readback: CAUSAL_WHY_CHAIN.readback,
    owner: CAUSAL_WHY_CHAIN.owner,
  },
};

const OTHER_ENTRY = { ...WEBHOOK_ENTRY, file: OTHER_FILE };

const WEBHOOK_DOCUMENT: RecordsDocument = {
  file: RECORDS_FILE,
  document: { version: 2, records: [WEBHOOK_ENTRY] },
};

const BOTH_DOCUMENT: RecordsDocument = {
  file: RECORDS_FILE,
  document: { version: 2, records: [WEBHOOK_ENTRY, OTHER_ENTRY] },
};

const UNRELATED_DOCUMENT: RecordsDocument = {
  file: UNRELATED_RECORDS_FILE,
  document: { version: 2, records: [] },
};

const ADDED_PLACE: RecordPlace = { file: RECORDS_FILE, index: 0 };

const OTHER_PLACE: RecordPlace = { file: RECORDS_FILE, index: 1 };

const SHORT_ROOT_CAUSE_ISSUES = [
  { path: ["whyChain", "rootCause"], message: "a root cause names what is true today" },
];

const NOT_A_RECORDS_DOCUMENT: readonly RecordsDocumentRefusal[] = [
  { kind: "not-a-records-file", file: RECORDS_FILE },
];

const editorAdding = (request: {
  readonly added: ReturnType<RecordsEditor["documentsWithAdded"]>;
  readonly place: RecordPlace;
}): Pick<RecordsEditor, "documentsWithAdded" | "placeOfAddition"> => ({
  documentsWithAdded: vi.fn<RecordsEditor["documentsWithAdded"]>().mockReturnValue(request.added),
  placeOfAddition: vi.fn<RecordsEditor["placeOfAddition"]>().mockReturnValue(request.place),
});

const readerRefusing = (
  refused: readonly { readonly place: RecordPlace; readonly refusals: readonly RecordRefusal[] }[],
): RecordsReader => ({
  recordsReadingOf: vi.fn<RecordsReader["recordsReadingOf"]>().mockReturnValue({
    outcome: "ok",
    value: {
      records: [],
      refused,
      notes: [],
      base: { measured: "no", base: { state: "not-given" } },
    },
  }),
});

const READER_REFUSING_NOTHING = readerRefusing([]);

const EDITOR_WRITING_WEBHOOK = editorAdding({
  added: { outcome: "ok", value: [WEBHOOK_DOCUMENT] },
  place: ADDED_PLACE,
});

const EDIT_FAILURE: RecordsEditFailure = {
  kind: "records-documents",
  refusals: NOT_A_RECORDS_DOCUMENT,
};

describe("the authorised location a person's arguments write", () => {
  it("writes one record from the arguments, with the why chain the person gave", () => {
    expect(
      authorisingOf({
        request: REQUEST,
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_REFUSING_NOTHING,
        recordsEditor: EDITOR_WRITING_WEBHOOK,
      }),
    ).toEqual({
      outcome: "ok",
      value: { judged: "accepted", edit: { write: [WEBHOOK_DOCUMENT], remove: [] } },
    });
  });

  it("hands the editor the arguments as one entry for the symptom's authorised-locations file", () => {
    const recordsEditor = editorAdding({
      added: { outcome: "ok", value: [WEBHOOK_DOCUMENT] },
      place: ADDED_PLACE,
    });
    authorisingOf({
      request: REQUEST,
      documents: [],
      catalogue: REPORT_CATALOGUE,
      recordsReader: READER_REFUSING_NOTHING,
      recordsEditor,
    });
    expect(recordsEditor.documentsWithAdded).toHaveBeenCalledWith({
      documents: [],
      additions: [{ file: RECORDS_FILE, entry: WEBHOOK_ENTRY }],
    });
  });

  it("files a record that names one check under its symptom, and keeps the check in the record", () => {
    const recordsEditor = editorAdding({
      added: { outcome: "ok", value: [WEBHOOK_DOCUMENT] },
      place: ADDED_PLACE,
    });
    authorisingOf({
      request: { ...REQUEST, answers: "claimed-type#cast-expressions" },
      documents: [],
      catalogue: REPORT_CATALOGUE,
      recordsReader: READER_REFUSING_NOTHING,
      recordsEditor,
    });
    expect(recordsEditor.documentsWithAdded).toHaveBeenCalledWith({
      documents: [],
      additions: [
        {
          file: RECORDS_FILE,
          entry: { ...WEBHOOK_ENTRY, answers: "claimed-type#cast-expressions" },
        },
      ],
    });
  });

  it("adds to the records the file already holds, reading the other files beside the file it rewrote", () => {
    const recordsReader = readerRefusing([]);
    const recordsEditor = editorAdding({
      added: { outcome: "ok", value: [BOTH_DOCUMENT] },
      place: OTHER_PLACE,
    });
    const authorised = authorisingOf({
      request: { ...REQUEST, file: OTHER_FILE },
      documents: [WEBHOOK_DOCUMENT, UNRELATED_DOCUMENT],
      catalogue: REPORT_CATALOGUE,
      recordsReader,
      recordsEditor,
    });
    expect(authorised).toEqual({
      outcome: "ok",
      value: { judged: "accepted", edit: { write: [BOTH_DOCUMENT], remove: [] } },
    });
    expect(recordsReader.recordsReadingOf).toHaveBeenCalledWith({
      documents: [UNRELATED_DOCUMENT, BOTH_DOCUMENT],
      catalogue: REPORT_CATALOGUE,
      base: { measured: "no", base: { state: "not-given" } },
    });
  });

  it("writes nothing for a record the file already holds, and says where", () => {
    expect(
      authorisingOf({
        request: REQUEST,
        documents: [WEBHOOK_DOCUMENT],
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerRefusing([
          { place: OTHER_PLACE, refusals: [{ kind: "duplicate", of: ADDED_PLACE }] },
        ]),
        recordsEditor: editorAdding({
          added: { outcome: "ok", value: [BOTH_DOCUMENT] },
          place: OTHER_PLACE,
        }),
      }),
    ).toEqual({
      outcome: "ok",
      value: { judged: "already-held", heldIn: RECORDS_FILE },
    });
  });

  it("accepts the added record when the reading refuses only a record at another place", () => {
    expect(
      authorisingOf({
        request: REQUEST,
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerRefusing([
          {
            place: OTHER_PLACE,
            refusals: [{ kind: "unknown-symptom", symptom: "no-such-symptom" }],
          },
        ]),
        recordsEditor: EDITOR_WRITING_WEBHOOK,
      }),
    ).toEqual({
      outcome: "ok",
      value: { judged: "accepted", edit: { write: [WEBHOOK_DOCUMENT], remove: [] } },
    });
  });

  it("refuses a why chain the reading refuses at the added record's place, and writes nothing", () => {
    expect(
      authorisingOf({
        request: { ...REQUEST, rootCause: "no" },
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerRefusing([
          {
            place: ADDED_PLACE,
            refusals: [{ kind: "form-refused", issues: SHORT_ROOT_CAUSE_ISSUES }],
          },
        ]),
        recordsEditor: EDITOR_WRITING_WEBHOOK,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        judged: "refused",
        refusals: [{ kind: "form-refused", issues: SHORT_ROOT_CAUSE_ISSUES }],
      },
    });
  });

  it("refuses with every refusal at the added record's place, a duplicate among them included", () => {
    expect(
      authorisingOf({
        request: REQUEST,
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerRefusing([
          {
            place: ADDED_PLACE,
            refusals: [
              { kind: "duplicate", of: OTHER_PLACE },
              { kind: "form-refused", issues: SHORT_ROOT_CAUSE_ISSUES },
            ],
          },
        ]),
        recordsEditor: EDITOR_WRITING_WEBHOOK,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        judged: "refused",
        refusals: [
          { kind: "duplicate", of: OTHER_PLACE },
          { kind: "form-refused", issues: SHORT_ROOT_CAUSE_ISSUES },
        ],
      },
    });
  });

  it("refuses a symptom the reading does not find in the catalogue", () => {
    expect(
      authorisingOf({
        request: { ...REQUEST, answers: "no-such-symptom" },
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: readerRefusing([
          {
            place: ADDED_PLACE,
            refusals: [{ kind: "unknown-symptom", symptom: "no-such-symptom" }],
          },
        ]),
        recordsEditor: EDITOR_WRITING_WEBHOOK,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        judged: "refused",
        refusals: [{ kind: "unknown-symptom", symptom: "no-such-symptom" }],
      },
    });
  });

  it("refuses a symptom whose name cannot name a records file, and edits nothing", () => {
    const recordsEditor = editorAdding({
      added: { outcome: "ok", value: [WEBHOOK_DOCUMENT] },
      place: ADDED_PLACE,
    });
    expect(
      authorisingOf({
        request: { ...REQUEST, answers: "Not A Name" },
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_REFUSING_NOTHING,
        recordsEditor,
      }),
    ).toEqual({
      outcome: "ok",
      value: { judged: "refused", refusals: [{ kind: "not-a-records-name", name: "Not A Name" }] },
    });
    expect(recordsEditor.documentsWithAdded).not.toHaveBeenCalled();
  });

  it("fails, rather than rewrite, when a records file it would add to is not a records document", () => {
    expect(
      authorisingOf({
        request: REQUEST,
        documents: [{ file: RECORDS_FILE, document: { records: [] } }],
        catalogue: REPORT_CATALOGUE,
        recordsReader: READER_REFUSING_NOTHING,
        recordsEditor: editorAdding({
          added: { outcome: "failed", error: EDIT_FAILURE },
          place: ADDED_PLACE,
        }),
      }),
    ).toEqual({ outcome: "failed", error: EDIT_FAILURE });
  });

  it("fails with the reading's refusals when the documents it would write cannot be read as records", () => {
    expect(
      authorisingOf({
        request: REQUEST,
        documents: [],
        catalogue: REPORT_CATALOGUE,
        recordsReader: {
          recordsReadingOf: vi
            .fn<RecordsReader["recordsReadingOf"]>()
            .mockReturnValue({ outcome: "failed", error: NOT_A_RECORDS_DOCUMENT }),
        },
        recordsEditor: EDITOR_WRITING_WEBHOOK,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "records-documents", refusals: NOT_A_RECORDS_DOCUMENT },
    });
  });
});
