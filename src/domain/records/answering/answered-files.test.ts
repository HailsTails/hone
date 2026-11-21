import { describe, expect, it } from "vitest";
import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import type { PlacedRecord } from "../../../infrastructure/hone-records-folder/hone-record.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { answeredFilesOf } from "./answered-files.ts";

const CLAIMED_TYPE: Symptom = { name: "claimed-type", title: "Claimed type", seen: "a value is given a type it was not checked for", mayIndicate: [], breachUsuallySits: "at the boundary", recipes: [], correctUses: [] };

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: clauseAddressSchema.parse("CD-1#explicit-any"),
  engines: [{ name: "eslint", mechanism: mechanismIdSchema.parse("eslint") }],
  forms: [],
};

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const placed = (request: { readonly record: PlacedRecord["record"]; readonly index: number }): PlacedRecord => ({
  place: { file: repoPathSchema.parse("hone-records/debt/claimed-type.json"), index: request.index },
  record: request.record,
});

describe("answeredFilesOf", () => {
  it("names the symptom for debt on the whole symptom and the check too for debt on one check", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({ index: 0, record: { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "whole-symptom" }, file: FILE_A, holding: { held: "stated" } } }),
          placed({ index: 1, record: { kind: "debt", symptom: CLAIMED_TYPE, reach: { reaches: "one-check", check: CAST_CHECK }, file: FILE_B, holding: { held: "stated" } } }),
        ],
      }),
    ).toEqual([
      { symptom: "claimed-type", file: FILE_A },
      { symptom: "claimed-type", check: "cast-expressions", file: FILE_B },
    ]);
  });

  it("names the symptom for an authorised location whose reach is the whole symptom", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({
            index: 0,
            record: {
              kind: "authorised-location",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "whole-symptom" },
              file: FILE_A,
              holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
            },
          }),
        ],
      }),
    ).toEqual([{ symptom: "claimed-type", file: FILE_A }]);
  });

  it("names nothing for an authorised location whose check its symptom does not have, since it answers nothing", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({
            index: 0,
            record: {
              kind: "authorised-location",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "unknown-check", check: "no-such-check" },
              file: FILE_A,
              holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
            },
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("names nothing for the records that answer by module, recipe or dependency rather than by file and symptom", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({ index: 0, record: { kind: "dependency-record", dependency: "zod", nativeWay: "parsing", whyNotEnough: "Repeated." } }),
        ],
      }),
    ).toEqual([]);
  });
});
