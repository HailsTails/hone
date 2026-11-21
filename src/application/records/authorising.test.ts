import { assert, describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../../tests/causal-why-chain.ts";
import { REPORT_CATALOGUE } from "../../../tests/report-catalogue.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { type AuthoriseRequest, authorisingOf } from "./authorising.ts";
import type { RecordsDocument } from "../../infrastructure/hone-records-folder/hone-record.ts";

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
  authorisingOf({ ...request, catalogue: REPORT_CATALOGUE });

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
