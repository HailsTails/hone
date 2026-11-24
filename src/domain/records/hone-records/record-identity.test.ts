import { describe, expect, it } from "vitest";

import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type {
  AuthorisedLocation,
  AuthorisedLocationLack,
  Carried,
  Debt,
  Deviation,
} from "./hone-record.ts";
import { identityPlaceOf, sameRecordIdentity } from "./record-identity.ts";

const SYMPTOM: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

describe("identityPlaceOf", () => {
  it("places a debt at its file and a dependency record at its dependency", () => {
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
          kind: "dependency-record",
          dependency: "zod",
          nativeWay: "hand-written parsing",
          whyNotEnough: "Each adapter would repeat its checks.",
        },
      }),
    ]).toEqual(["src/a.ts", "zod"]);
  });
});

describe("sameRecordIdentity", () => {
  const DEBT: Debt = {
    kind: "debt",
    symptom: SYMPTOM,
    reach: { reaches: "whole-symptom" },
    file: repoPathOf("src/a.ts"),
    holding: { held: "stated" },
  };

  it("holds two debts on the same symptom of the same rule set at one file to be the same", () => {
    expect(sameRecordIdentity({ left: DEBT, right: { ...DEBT } })).toBe("same");
  });

  it("holds a team's debt different from Hone's on a symptom of the same name at one file", () => {
    expect(
      sameRecordIdentity({
        left: DEBT,
        right: { ...DEBT, symptom: { ...SYMPTOM, ruleSet: { name: ruleSetNameOf("acme") } } },
      }),
    ).toBe("different");
  });

  it("holds a team's deviation different from Hone's from a recipe of the same name at one file", () => {
    const deviation: Deviation = {
      kind: "deviation",
      recipe: {
        ruleSet: "hone",
        name: "functional-iteration",
        title: "Functional iteration",
        standing: "accepted",
        reason: { text: "Reason.", standing: "accepted" },
      },
      file: repoPathOf("src/a.ts"),
      reasonFails: "Fails.",
      evidence: "Evidence.",
      ruleHolds: "Holds.",
    };
    expect(
      sameRecordIdentity({
        left: deviation,
        right: {
          ...deviation,
          recipe: { ...deviation.recipe, ruleSet: { name: ruleSetNameOf("acme") } },
        },
      }),
    ).toBe("different");
  });
});

describe("sameRecordIdentity, an authorised location bound to an outside party", () => {
  const IMPORTS: Symptom = { ...SYMPTOM, name: "outside-import-past-a-boundary" };

  const IMPORT_CHECK: Check = {
    name: "import-or-require",
    symptom: IMPORTS,
    page: "outside-import-past-a-boundary/import-or-require.md",
    engines: [],
    forms: [],
    findingSpecifics: ["outside-party"],
  };

  const ZOD_HOLDING: Carried<AuthorisedLocationLack> = {
    held: "carried",
    entry: { reason: "zod stays here." },
    lacks: ["case", "owes", "whyChain"],
    standing: "unjudged",
  };

  const ZOD_LOCATION: AuthorisedLocation = {
    kind: "authorised-location",
    symptom: IMPORTS,
    reach: { reaches: "one-check", check: IMPORT_CHECK },
    file: repoPathOf("src/adapters/schemas.ts"),
    holding: {
      binding: {
        binds: "check-file-and-outside-party",
        outsideParty: { kind: "package", dependency: "zod" },
      },
      held: "carried",
      entry: { reason: "zod stays here." },
      lacks: ["case", "owes", "whyChain"],
      standing: "unjudged",
    },
  };

  it("holds two with the same answers and file and different parties to be different", () => {
    const uuidLocation: AuthorisedLocation = {
      ...ZOD_LOCATION,
      holding: {
        ...ZOD_HOLDING,
        binding: {
          binds: "check-file-and-outside-party",
          outsideParty: { kind: "package", dependency: "uuid" },
        },
      },
    };

    const sameness = sameRecordIdentity({ left: ZOD_LOCATION, right: uuidLocation });

    expect(sameness).toBe("different");
  });

  it("holds two with the same answers, file and party to be the same", () => {
    const restated: AuthorisedLocation = {
      ...ZOD_LOCATION,
      holding: {
        ...ZOD_HOLDING,
        binding: {
          binds: "check-file-and-outside-party",
          outsideParty: { kind: "package", dependency: "zod" },
        },
      },
    };

    const sameness = sameRecordIdentity({ left: ZOD_LOCATION, right: restated });

    expect(sameness).toBe("same");
  });

  it("holds a scheme different from a module of that scheme", () => {
    const scheme: AuthorisedLocation = {
      ...ZOD_LOCATION,
      holding: {
        ...ZOD_HOLDING,
        binding: {
          binds: "check-file-and-outside-party",
          outsideParty: { kind: "scheme", scheme: "node:" },
        },
      },
    };
    const module: AuthorisedLocation = {
      ...ZOD_LOCATION,
      holding: {
        ...ZOD_HOLDING,
        binding: {
          binds: "check-file-and-outside-party",
          outsideParty: { kind: "scheme-module", specifier: "node:fs" },
        },
      },
    };

    const sameness = sameRecordIdentity({ left: scheme, right: module });

    expect(sameness).toBe("different");
  });

  it("holds an authorised location different from debt on the same check and file", () => {
    const debt: Debt = {
      kind: "debt",
      symptom: IMPORTS,
      reach: { reaches: "one-check", check: IMPORT_CHECK },
      file: ZOD_LOCATION.file,
      holding: { held: "stated" },
    };

    const sameness = sameRecordIdentity({ left: ZOD_LOCATION, right: debt });

    expect(sameness).toBe("different");
  });
});
