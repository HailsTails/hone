import { describe, expect, it } from "vitest";
import { LOOP_KEYWORD_LOOPS, SETTINGS_CATALOGUE } from "../../../../tests/settings-catalogue.ts";
import type { HoneRecord } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import { holdsAt, type Site } from "./record-reach.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";

const SRC_A = repoPathSchema.parse("src/a.ts");

const WRITTEN_DEBT: HoneRecord = {
  kind: "debt",
  symptom: LOOP_KEYWORD_LOOPS.symptom,
  reach: { reaches: "one-check", check: LOOP_KEYWORD_LOOPS },
  file: SRC_A,
  note: "legacy loop",
  holding: { held: "stated" },
};

const siteWith = (request: { readonly party: Site["party"] }): Site => ({
  symptom: LOOP_KEYWORD_LOOPS.symptom,
  check: { found: "check", check: LOOP_KEYWORD_LOOPS },
  file: SRC_A,
  party: request.party,
});

describe("a debt the upgrade writes, which names no outside party", () => {
  it("still holds a site whose party the run reports as a specifier", () => {
    expect(holdsAt({ record: WRITTEN_DEBT, site: siteWith({ party: { reported: "specifier", specifier: "lodash" } }), catalogue: SETTINGS_CATALOGUE })).toBe("holds");
  });

  it("holds a site whose party is not reported", () => {
    expect(holdsAt({ record: WRITTEN_DEBT, site: siteWith({ party: { reported: "not-reported" } }), catalogue: SETTINGS_CATALOGUE })).toBe("holds");
  });
});
