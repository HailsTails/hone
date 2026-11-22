import { describe, expect, it } from "vitest";
import { disciplineIdOf } from "./discipline-id-of.ts";
import { enginesFolderSegmentsOf, pieceFolderSegmentsOf } from "./piece-folder.ts";

describe("enginesFolderSegmentsOf", () => {
  it("is the install's engines source folder for the install's own rule set", () => {
    expect(enginesFolderSegmentsOf({ ruleSetRoot: "/install", installRoot: "/install" })).toEqual(["src", "infrastructure", "engines"]);
  });

  it("is the mechanisms folder for a rule set outside the install", () => {
    expect(enginesFolderSegmentsOf({ ruleSetRoot: "/team", installRoot: "/install" })).toEqual(["mechanisms"]);
  });
});

describe("pieceFolderSegmentsOf", () => {
  it("names the piece folder of a discipline under a mechanism in the install's own rule set", () => {
    expect(
      pieceFolderSegmentsOf({ ruleSetRoot: "/install", installRoot: "/install", mechanism: "audit", discipline: disciplineIdOf("CD-14") }),
    ).toEqual(["/install", "src", "infrastructure", "engines", "audit", "CD-14"]);
  });

  it("names the piece folder of a discipline under a mechanism in another rule set", () => {
    expect(
      pieceFolderSegmentsOf({ ruleSetRoot: "/team", installRoot: "/install", mechanism: "eslint", discipline: disciplineIdOf("TM-1") }),
    ).toEqual(["/team", "mechanisms", "eslint", "TM-1"]);
  });
});
