import { describe, expect, it } from "vitest";

import type { UpgradeRefusal } from "../../../domain/records/upgrade/upgrade-refusal.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { mapMappingRefusalToLine } from "./mapping-refusal-text.ts";

type LineRow = { readonly name: string; readonly refusal: UpgradeRefusal; readonly line: string };

describe("mapMappingRefusalToLine", () => {
  it.each<LineRow>([
    {
      name: "a file carve-out that answers no finding",
      refusal: {
        kind: "record-answers-nothing",
        clause: "CD-15#loops",
        file: repoPathOf("src/a.ts"),
        credited: "nothing",
      },
      line: "the file carve-out for CD-15#loops in src/a.ts answers no finding. Remove it, or fix the file it names, then run the upgrade again.",
    },
    {
      name: "a file carve-out that held up only a suppression no record can hold",
      refusal: {
        kind: "record-answers-nothing",
        clause: "CD-15#loops",
        file: repoPathOf("src/a.ts"),
        credited: "suppression-only",
      },
      line: "the file carve-out for CD-15#loops in src/a.ts answers only a suppression no version 2 record can hold. Remove it, or fix the file it names, then run the upgrade again.",
    },
    {
      name: "a project clause with no version 2 check",
      refusal: { kind: "clause-without-check", clause: "acme/CD-1#thing" },
      line: "acme/CD-1#thing has no version 2 check to run it, and version 2 does not carry the clauses of a version 1 team rule set. Remove it from disciplines.json to upgrade without it, or stay on version 1.",
    },
    {
      name: "confined packages that cannot be read",
      refusal: {
        kind: "confined-packages-unreadable",
        detail: "confinedPackages for CD-19#import-boundaries is not a list of package names",
      },
      line: "the confined packages cannot be read (confinedPackages for CD-19#import-boundaries is not a list of package names). Correct confinedPackages in disciplines.json, then run the upgrade again.",
    },
    {
      name: "a check whose symptom no catalogue holds",
      refusal: { kind: "symptom-unheld", symptom: { ruleSet: "hone", name: "claimed-type" } },
      line: "claimed-type: the catalogue and the records disagree, since a check, sighting or record names this symptom and no catalogue holds it. This is a fault in hone, not in your repository. Report it at https://github.com/HailsTails/hone/issues, with this output.",
    },
  ])("writes $name as the line that says what to do", ({ refusal, line }) => {
    expect(mapMappingRefusalToLine({ refusal })).toBe(line);
  });
});
