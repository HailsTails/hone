import { describe, expect, it } from "vitest";

import type { Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { identityPlaceOf } from "./record-identity.ts";

const SYMPTOM: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

describe("identityPlaceOf", () => {
  it("places a debt at its file, a boundary record at its module and a dependency record at its dependency", () => {
    expect([
      identityPlaceOf({
        record: {
          kind: "debt",
          symptom: SYMPTOM,
          reach: { reaches: "whole-symptom" },
          file: repoPathOf("src/a.ts"),
          holding: { held: "stated" },
        },
      }),
      identityPlaceOf({
        record: {
          kind: "boundary-record",
          module: repoPathOf("src/adapters"),
          outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" },
          holding: { held: "stated", ports: ["Ids"] },
        },
      }),
      identityPlaceOf({
        record: {
          kind: "dependency-record",
          dependency: "zod",
          nativeWay: "hand-written parsing",
          whyNotEnough: "Each adapter would repeat its checks.",
        },
      }),
    ]).toEqual(["src/a.ts", "src/adapters", "zod"]);
  });
});
