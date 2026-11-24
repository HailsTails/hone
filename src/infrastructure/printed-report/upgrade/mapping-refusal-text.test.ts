import { describe, expect, it } from "vitest";

import type { UpgradeRefusal } from "../../../domain/records/upgrade/upgrade-refusal.ts";
import { mapMappingRefusalToLine } from "./mapping-refusal-text.ts";

type LineRow = { readonly name: string; readonly refusal: UpgradeRefusal; readonly line: string };

describe("mapMappingRefusalToLine", () => {
  it.each<LineRow>([
    {
      name: "a project clause with no version 2 check",
      refusal: { kind: "clause-without-check", clause: "acme/CD-1#thing" },
      line: "acme/CD-1#thing has no version 2 check to run it, and version 2 does not carry the clauses of a version 1 team rule set. Remove it from disciplines.json to upgrade without it, or stay on version 1.",
    },
    {
      name: "confined packages that cannot be read",
      refusal: { kind: "confined-packages-unreadable", clause: "CD-19#import-boundaries" },
      line: "confinedPackages for CD-19#import-boundaries in disciplines.json is not a list of package names. Correct it, then run the upgrade again.",
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
