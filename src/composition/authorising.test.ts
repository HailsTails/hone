import { assert, describe, expect, it } from "vitest";
import type { Check, Engine, RecordKind, Rule, Symptom, SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../infrastructure/hone-records-folder/repo-path.ts";
import type { WhyChain } from "../domain/records/why-chain.ts";
import { authorisingOf } from "../application/records/authorising.ts";
import { recordsReader } from "../infrastructure/hone-records-folder/reading/records-reading.ts";
import { recordsEditor } from "../infrastructure/hone-records-folder/writing/records-edit.ts";
import type { AuthoriseRequest } from "../application/ports/authorising.ts";
import type { RecordsDocument } from "../domain/records/hone-records/hone-record.ts";

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

const CAST_EXPRESSIONS = clauseAddressSchema.parse("CD-2#cast-expressions");

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

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

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

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

const CAST_CHECK: Check = { name: "cast-expressions", symptom: CLAIMED_TYPE, clause: CAST_EXPRESSIONS, engines: [ESLINT_ENGINE], forms: [] };

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [{ name: "one-place-decides", title: "One place decides" }],
  rules: [DECLARED_NOT_ASSERTED],
  cases: [CLAIMED_TYPE.mayIndicate[0].case],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [ESLINT_ENGINE],
  symptoms: [CLAIMED_TYPE],
  clauses: [{ clause: CAST_EXPRESSIONS, sight: { kind: "one-symptom", symptom: CLAIMED_TYPE } }],
  checks: [CAST_CHECK],
  namedBans: [],
};

const WEBHOOK_FILE = repoPathSchema.parse("src/adapters/stripe-webhook.ts");

const RECORDS_FILE = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

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

const NO_DOCUMENTS: readonly RecordsDocument[] = [];

const authorised = (request: { readonly request: AuthoriseRequest; readonly documents: readonly RecordsDocument[] }) =>
  authorisingOf({ ...request, catalogue: REPORT_CATALOGUE, recordsReader, recordsEditor });

const OTHER_FILE = repoPathSchema.parse("src/adapters/other-webhook.ts");

const [FIRST_WHY, SECOND_WHY, THIRD_WHY, FOURTH_WHY] = CAUSAL_WHY_CHAIN.whys;

describe("the authorised location a person's arguments write", () => {
  it("writes one record from the arguments, with the why chain the person gave", () => {
    expect(authorised({ request: REQUEST, documents: NO_DOCUMENTS })).toEqual({
      outcome: "ok",
      value: {
        judged: "accepted",
        edit: {
          write: [
            {
              file: RECORDS_FILE,
              document: {
                version: 2,
                records: [
                  {
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
                  },
                ],
              },
            },
          ],
          remove: [],
        },
      },
    });
  });

  it("files a record that names one check under its symptom, and keeps the check in the record", () => {
    const authorisedCheck = authorised({ request: { ...REQUEST, answers: "claimed-type#cast-expressions" }, documents: NO_DOCUMENTS });
    expect(authorisedCheck).toMatchObject({
      outcome: "ok",
      value: { judged: "accepted", edit: { write: [{ file: RECORDS_FILE, document: { records: [{ answers: "claimed-type#cast-expressions" }] } }] } },
    });
  });

  it("adds to the records the file already holds", () => {
    const first = authorised({ request: REQUEST, documents: NO_DOCUMENTS });
    assert(first.outcome === "ok", "the first record is read");
    assert(first.value.judged === "accepted", "the first record is accepted");
    const second = authorised({ request: { ...REQUEST, file: OTHER_FILE }, documents: first.value.edit.write });
    expect(second).toMatchObject({
      outcome: "ok",
      value: {
        judged: "accepted",
        edit: { write: [{ file: RECORDS_FILE, document: { version: 2, records: [expect.objectContaining({ file: WEBHOOK_FILE }), expect.objectContaining({ file: OTHER_FILE })] } }] },
      },
    });
  });

  it("writes nothing for a record the file already holds, and says where", () => {
    const first = authorised({ request: REQUEST, documents: NO_DOCUMENTS });
    assert(first.outcome === "ok", "the first record is read");
    assert(first.value.judged === "accepted", "the first record is accepted");
    expect(authorised({ request: REQUEST, documents: first.value.edit.write })).toEqual({
      outcome: "ok",
      value: { judged: "already-held", heldIn: RECORDS_FILE },
    });
  });

  it("accepts a case or owes the catalogue does not list, since an authorised location is never refused for it", () => {
    expect(authorised({ request: { ...REQUEST, case: "no-such-case", owes: "nothing" }, documents: NO_DOCUMENTS })).toMatchObject({ outcome: "ok", value: { judged: "accepted" } });
  });

  it("refuses a why chain the why-chain contract refuses, and writes nothing", () => {
    expect(authorised({ request: { ...REQUEST, rootCause: "no" }, documents: NO_DOCUMENTS })).toEqual({
      outcome: "ok",
      value: { judged: "refused", refusals: [{ kind: "form-refused", issues: expect.any(Array) }] },
    });
  });

  it("refuses a chain of fewer than five whys", () => {
    expect(authorised({ request: { ...REQUEST, whys: [FIRST_WHY, SECOND_WHY, THIRD_WHY, FOURTH_WHY] }, documents: NO_DOCUMENTS })).toMatchObject({
      outcome: "ok",
      value: { judged: "refused", refusals: [{ kind: "form-refused" }] },
    });
  });

  it("refuses a symptom the catalogue does not name", () => {
    expect(authorised({ request: { ...REQUEST, answers: "no-such-symptom" }, documents: NO_DOCUMENTS })).toEqual({
      outcome: "ok",
      value: { judged: "refused", refusals: [{ kind: "unknown-symptom", symptom: "no-such-symptom" }] },
    });
  });

  it("refuses a symptom whose name cannot name a records file", () => {
    expect(authorised({ request: { ...REQUEST, answers: "Not A Name" }, documents: NO_DOCUMENTS })).toEqual({
      outcome: "ok",
      value: { judged: "refused", refusals: [{ kind: "not-a-records-name", name: "Not A Name" }] },
    });
  });

  it("fails, rather than rewrite, when a records file it would add to is not a records document", () => {
    expect(authorised({ request: REQUEST, documents: [{ file: RECORDS_FILE, document: { records: [] } }] })).toMatchObject({
      outcome: "failed",
      error: { kind: "records-documents" },
    });
  });
});
