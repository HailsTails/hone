import { describe, expect, it } from "vitest";

import { catalogueNameOf } from "../language-layer/catalogue-name.ts";
import { disciplineIdOf } from "./discipline-id-of.ts";
import {
  enginesFolderSegmentsOf,
  namedPieceFolderSegmentsOf,
  pieceFolderSegmentsOf,
} from "./piece-folder.ts";

describe("enginesFolderSegmentsOf", () => {
  it("is the install's engines source folder for the install's own rule set", () => {
    expect(enginesFolderSegmentsOf({ ruleSetRoot: "/install", installRoot: "/install" })).toEqual([
      "src",
      "infrastructure",
      "engines",
    ]);
  });

  it("is the mechanisms folder for a rule set outside the install", () => {
    expect(enginesFolderSegmentsOf({ ruleSetRoot: "/team", installRoot: "/install" })).toEqual([
      "mechanisms",
    ]);
  });
});

describe("pieceFolderSegmentsOf", () => {
  it("names the piece folder of a discipline under a mechanism in the install's own rule set", () => {
    expect(
      pieceFolderSegmentsOf({
        ruleSetRoot: "/install",
        installRoot: "/install",
        mechanism: "walker",
        discipline: disciplineIdOf("CD-14"),
      }),
    ).toEqual(["/install", "src", "infrastructure", "engines", "walker", "CD-14"]);
  });

  it("names the piece folder of a discipline under a mechanism in another rule set", () => {
    expect(
      pieceFolderSegmentsOf({
        ruleSetRoot: "/team",
        installRoot: "/install",
        mechanism: "eslint",
        discipline: disciplineIdOf("TM-1"),
      }),
    ).toEqual(["/team", "mechanisms", "eslint", "TM-1"]);
  });
});

describe("namedPieceFolderSegmentsOf", () => {
  it("locates a shipped check by its symptom and name", () => {
    expect(
      namedPieceFolderSegmentsOf({
        ruleSetRoot: "/install",
        installRoot: "/install",
        mechanism: "walker",
        symptom: catalogueNameOf("ambient-randomness"),
        check: catalogueNameOf("direct-call"),
      }),
    ).toEqual([
      "/install",
      "src",
      "infrastructure",
      "engines",
      "walker",
      "ambient-randomness",
      "direct-call",
    ]);
  });
});
