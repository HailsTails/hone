import { describe, expect, it } from "vitest";

import { listDivergentBindings, listUnreportedBindings } from "./binding-invariants.ts";
import type { AuthorisedLocationKind, CheckContent, Symptom } from "./symptom-catalogue.ts";

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

describe("listDivergentBindings", () => {
  it("lists nothing for a symptom whose authorised-location correct uses bind alike", () => {
    const outsideImport: Symptom = {
      ruleSet: "hone",
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const symptom: Symptom = {
      ...outsideImport,
      correctUses: [
        ...outsideImport.correctUses,
        {
          situation: "a vendored copy",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };

    const faults = listDivergentBindings({ symptom });

    expect(faults).toEqual([]);
  });

  it("lists a symptom whose authorised-location correct uses bind differently", () => {
    const outsideImport: Symptom = {
      ruleSet: "hone",
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const symptom: Symptom = {
      ...outsideImport,
      correctUses: [
        ...outsideImport.correctUses,
        { situation: "a test", kind: AUTHORISED_LOCATION, binding: "check-and-file" },
      ],
    };

    const faults = listDivergentBindings({ symptom });

    expect(faults).toEqual([
      { kind: "divergent-bindings", symptom: "outside-import-past-a-boundary" },
    ]);
  });
});

describe("listUnreportedBindings", () => {
  it("lists nothing when each check of a symptom that binds the outside party reports it", () => {
    const outsideImport: Symptom = {
      ruleSet: "hone",
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const check: CheckContent = {
      name: "import-or-require",
      symptom: outsideImport,
      page: "outside-import-past-a-boundary/import-or-require.md",
      forms: [],
      findingSpecifics: ["outside-party"],
    };

    const faults = listUnreportedBindings({ symptoms: [outsideImport], checks: [check] });

    expect(faults).toEqual([]);
  });

  it("lists each check of a symptom that binds the outside party whose findings do not report it", () => {
    const outsideImport: Symptom = {
      ruleSet: "hone",
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const check: CheckContent = {
      name: "import-or-require",
      symptom: outsideImport,
      page: "outside-import-past-a-boundary/import-or-require.md",
      forms: [],
      findingSpecifics: [],
    };

    const faults = listUnreportedBindings({ symptoms: [outsideImport], checks: [check] });

    expect(faults).toEqual([
      {
        kind: "binding-not-reported",
        symptom: "outside-import-past-a-boundary",
        check: "import-or-require",
      },
    ]);
  });

  it("lists nothing for a check whose symptom binds only the check and file", () => {
    const outsideImport: Symptom = {
      ruleSet: "hone",
      name: "outside-import-past-a-boundary",
      title: "Outside import past a boundary",
      seen: "A package imported outside its adapter.",
      mayIndicate: [],
      breachUsuallySits: "in the importing file",
      recipes: [],
      correctUses: [
        {
          situation: "the adapter for that outside party",
          kind: AUTHORISED_LOCATION,
          binding: "check-file-and-outside-party",
        },
      ],
    };
    const symptom: Symptom = {
      ...outsideImport,
      correctUses: [{ situation: "a test", kind: AUTHORISED_LOCATION, binding: "check-and-file" }],
    };
    const check: CheckContent = {
      name: "import-or-require",
      symptom,
      page: "outside-import-past-a-boundary/import-or-require.md",
      forms: [],
      findingSpecifics: [],
    };

    const faults = listUnreportedBindings({ symptoms: [symptom], checks: [check] });

    expect(faults).toEqual([]);
  });
});
