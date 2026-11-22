import { describe, expect, it } from "vitest";
import { carriedStandingOf } from "./carried-standing.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";

const FILE = repoPathOf("hone-records/authorised-locations/claimed-type.json");

const ENTRY = { answers: "claimed-type", file: "src/a.ts", carried: { kind: "authorised-location", clause: "CD-2#cast-expressions", file: "src/a.ts", reason: "Kept." } };

describe("carriedStandingOf", () => {
  it("leaves a carried record unjudged when the base revision is not measured", () => {
    expect(carriedStandingOf({ base: { measured: "no", base: { state: "not-given" } }, file: FILE, entry: ENTRY })).toEqual({ outcome: "ok", value: "unjudged" });
  });

  it("establishes a carried record the same file at the base revision holds word for word, whatever its keys' order", () => {
    expect(
      carriedStandingOf({
        base: { measured: "yes", documents: [{ file: FILE, document: { version: 2, records: [{ carried: ENTRY.carried, file: "src/a.ts", answers: "claimed-type" }] } }] },
        file: FILE,
        entry: ENTRY,
      }),
    ).toEqual({ outcome: "ok", value: "established" });
  });

  it("refuses a carried record that only another file at the base revision holds", () => {
    expect(
      carriedStandingOf({
        base: { measured: "yes", documents: [{ file: repoPathOf("hone-records/debt/claimed-type.json"), document: { version: 2, records: [ENTRY] } }] },
        file: FILE,
        entry: ENTRY,
      }),
    ).toEqual({ outcome: "failed", error: [{ kind: "carried-changed-since-base" }] });
  });

  it("refuses a carried record when the base revision's file is not a records document", () => {
    expect(carriedStandingOf({ base: { measured: "yes", documents: [{ file: FILE, document: { records: [ENTRY] } }] }, file: FILE, entry: ENTRY })).toEqual({
      outcome: "failed",
      error: [{ kind: "carried-changed-since-base" }],
    });
  });
});
