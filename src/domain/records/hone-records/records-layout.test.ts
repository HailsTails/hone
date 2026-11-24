import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { RuleSetIdentity } from "../../rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import { namedRecordsFileOf, recordsFileStandingOf } from "./records-layout.ts";

const ACME = { name: ruleSetNameOf("acme") };

describe("recordsFileStandingOf", () => {
  it.each([
    {
      file: repoPathOf("hone-records/debt/text-past-its-reader.json"),
      standing: {
        standing: "named",
        ruleSet: TOOL_RULE_SET,
        kind: "debt",
        name: "text-past-its-reader",
      },
    },
    {
      file: repoPathOf("hone-records/authorised-locations/claimed-type.json"),
      standing: {
        standing: "named",
        ruleSet: TOOL_RULE_SET,
        kind: "authorised-locations",
        name: "claimed-type",
      },
    },
    {
      file: repoPathOf("hone-records/deviations/stub-with-vi-fn.json"),
      standing: {
        standing: "named",
        ruleSet: TOOL_RULE_SET,
        kind: "deviations",
        name: "stub-with-vi-fn",
      },
    },
    {
      file: repoPathOf("hone-records/acme/debt/console-output.json"),
      standing: { standing: "named", ruleSet: ACME, kind: "debt", name: "console-output" },
    },
    {
      file: repoPathOf("hone-records/acme/authorised-locations/console-output.json"),
      standing: {
        standing: "named",
        ruleSet: ACME,
        kind: "authorised-locations",
        name: "console-output",
      },
    },
    {
      file: repoPathOf("hone-records/boundary-records.json"),
      standing: { standing: "single", kind: "boundary-records" },
    },
    {
      file: repoPathOf("hone-records/dependency-records.json"),
      standing: { standing: "single", kind: "dependency-records" },
    },
  ])("reads $file as a records file of its folder", ({ file, standing }) => {
    expect(recordsFileStandingOf({ file })).toEqual(standing);
  });

  it.each([
    {
      file: repoPathOf("hone-records/notes.md"),
      why: "a file at the top that is not one of the two single files",
    },
    {
      file: repoPathOf("hone-records/debt/claimed-type.txt"),
      why: "a file in a kind folder that is not JSON",
    },
    { file: repoPathOf("hone-records/debt/.json"), why: "a JSON file with no name" },
    {
      file: repoPathOf("hone-records/carve-outs/claimed-type.json"),
      why: "a folder that is not a kind",
    },
    {
      file: repoPathOf("hone-records/debt/acme/claimed-type.json"),
      why: "a folder inside a kind folder",
    },
    {
      file: repoPathOf("hone-records/hone/debt/claimed-type.json"),
      why: "a rule set folder named for Hone's own rule set, whose records sit at the top",
    },
    {
      file: repoPathOf("hone-records/Acme/debt/claimed-type.json"),
      why: "a rule set folder whose name is no rule set name",
    },
    {
      file: repoPathOf("hone-records/debt/debt/claimed-type.json"),
      why: "a rule set folder named for a kind folder",
    },
    {
      file: repoPathOf("hone-records/acme/boundary-records.json"),
      why: "a single file inside a rule set folder, which holds only kind folders",
    },
    {
      file: repoPathOf("hone-records/acme/debt/nested/claimed-type.json"),
      why: "a folder inside a rule set's kind folder",
    },
    {
      file: repoPathOf("discipline-exceptions/authorised-locations/cd-6.json"),
      why: "a file outside the records folder",
    },
    { file: repoPathOf("hone-records"), why: "the records folder itself" },
  ])("reads $file as no records file: $why", ({ file }) => {
    expect(recordsFileStandingOf({ file })).toEqual({ standing: "not-a-records-file" });
  });
});

describe("the records file a record belongs in", () => {
  it("names a kind folder's file after the symptom or recipe it holds", () => {
    expect(
      namedRecordsFileOf({
        ruleSet: TOOL_RULE_SET,
        kind: "authorised-locations",
        name: "claimed-type",
      }),
    ).toEqual({
      outcome: "ok",
      value: "hone-records/authorised-locations/claimed-type.json",
    });
  });

  it("names a team's kind folder's file inside its rule set's folder", () => {
    expect(namedRecordsFileOf({ ruleSet: ACME, kind: "debt", name: "console-output" })).toEqual({
      outcome: "ok",
      value: "hone-records/acme/debt/console-output.json",
    });
  });

  it.each([{ name: "/x" }, { name: "../claimed-type" }, { name: "claimed-type\n" }, { name: "" }])(
    "names no file for a name written $name, without throwing",
    ({ name }) => {
      expect(namedRecordsFileOf({ ruleSet: TOOL_RULE_SET, kind: "debt", name })).toEqual({
        outcome: "failed",
        error: { kind: "not-a-records-name", folder: "hone-records/debt", name },
      });
    },
  );

  it("carries a team's folder in the failure for a name it cannot hold", () => {
    expect(namedRecordsFileOf({ ruleSet: ACME, kind: "debt", name: "../x" })).toEqual({
      outcome: "failed",
      error: { kind: "not-a-records-name", folder: "hone-records/acme/debt", name: "../x" },
    });
  });
});
