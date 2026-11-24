import { describe, expect, it } from "vitest";

import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type { PlacedRecord } from "../hone-records/hone-record.ts";
import { answeredFilesOf } from "./answered-files.ts";

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "a value is given a type it was not checked for",
  mayIndicate: [],
  breachUsuallySits: "at the boundary",
  recipes: [],
  correctUses: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-1"),
    clause: clauseIdOf("explicit-any"),
  },
  engines: [{ name: "eslint" }],
  forms: [],
  findingSpecifics: [],
};

const FILE_A = repoPathOf("src/a.ts");

const FILE_B = repoPathOf("src/b.ts");

const placed = (request: {
  readonly record: PlacedRecord["record"];
  readonly index: number;
}): PlacedRecord => ({
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: request.index },
  record: request.record,
});

describe("answeredFilesOf", () => {
  it("names the symptom for debt on the whole symptom and the check too for debt on one check", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({
            index: 0,
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "whole-symptom" },
              file: FILE_A,
              holding: { held: "stated" },
            },
          }),
          placed({
            index: 1,
            record: {
              kind: "debt",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "one-check", check: CAST_CHECK },
              file: FILE_B,
              holding: { held: "stated" },
            },
          }),
        ],
      }),
    ).toEqual([
      { ruleSet: TOOL_RULE_SET, symptom: "claimed-type", file: FILE_A },
      { ruleSet: TOOL_RULE_SET, symptom: "claimed-type", check: "cast-expressions", file: FILE_B },
    ]);
  });

  it("names the check for an authorised location bound to its check and file", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({
            index: 0,
            record: {
              kind: "authorised-location",
              symptom: CLAIMED_TYPE,
              reach: { reaches: "one-check", check: CAST_CHECK },
              file: FILE_A,
              holding: {
                binding: { binds: "check-and-file" },
                held: "carried",
                entry: {},
                lacks: [],
                standing: "unjudged",
              },
            },
          }),
        ],
      }),
    ).toEqual([
      { ruleSet: TOOL_RULE_SET, symptom: "claimed-type", check: "cast-expressions", file: FILE_A },
    ]);
  });

  it("names nothing for an authorised location bound to an outside party, since the check must still run on the file's other imports", () => {
    const answered = answeredFilesOf({
      records: [
        placed({
          index: 0,
          record: {
            kind: "authorised-location",
            symptom: CLAIMED_TYPE,
            reach: { reaches: "one-check", check: CAST_CHECK },
            file: FILE_A,
            holding: {
              binding: {
                binds: "check-file-and-outside-party",
                outsideParty: { kind: "package", dependency: "zod" },
              },
              held: "carried",
              entry: {},
              lacks: [],
              standing: "unjudged",
            },
          },
        }),
      ],
    });

    expect(answered).toEqual([]);
  });

  it("names a team symptom's file with the team's rule set", () => {
    const acme = { name: ruleSetNameOf("acme") };
    expect(
      answeredFilesOf({
        records: [
          placed({
            index: 0,
            record: {
              kind: "debt",
              symptom: { ...CLAIMED_TYPE, ruleSet: acme },
              reach: { reaches: "whole-symptom" },
              file: FILE_A,
              holding: { held: "stated" },
            },
          }),
        ],
      }),
    ).toEqual([{ ruleSet: acme, symptom: "claimed-type", file: FILE_A }]);
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
              holding: {
                binding: { binds: "check-and-file" },
                held: "carried",
                entry: {},
                lacks: [],
                standing: "unjudged",
              },
            },
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("names nothing for a record that answers by dependency rather than by file and symptom", () => {
    expect(
      answeredFilesOf({
        records: [
          placed({
            index: 0,
            record: {
              kind: "dependency-record",
              dependency: "zod",
              nativeWay: "parsing",
              whyNotEnough: "Repeated.",
            },
          }),
        ],
      }),
    ).toEqual([]);
  });
});
