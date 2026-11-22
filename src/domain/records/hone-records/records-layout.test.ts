import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { namedRecordsFileOf, recordsFileStandingOf } from "./records-layout.ts";

describe("recordsFileStandingOf", () => {
  it.each([
    {
      file: repoPathOf("hone-records/debt/text-past-its-reader.json"),
      standing: { standing: "named", kind: "debt", name: "text-past-its-reader" },
    },
    {
      file: repoPathOf("hone-records/authorised-locations/claimed-type.json"),
      standing: { standing: "named", kind: "authorised-locations", name: "claimed-type" },
    },
    {
      file: repoPathOf("hone-records/deviations/stub-with-vifn.json"),
      standing: { standing: "named", kind: "deviations", name: "stub-with-vifn" },
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
      file: repoPathOf("hone-records/team/debt/claimed-type.json"),
      why: "a folder inside a kind folder's place",
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
    expect(namedRecordsFileOf({ kind: "authorised-locations", name: "claimed-type" })).toEqual({
      outcome: "ok",
      value: "hone-records/authorised-locations/claimed-type.json",
    });
  });

  it.each([{ name: "/x" }, { name: "../claimed-type" }, { name: "claimed-type\n" }, { name: "" }])(
    "names no file for a name written $name, without throwing",
    ({ name }) => {
      expect(namedRecordsFileOf({ kind: "debt", name })).toEqual({
        outcome: "failed",
        error: { kind: "not-a-records-name", name },
      });
    },
  );
});
