import { createDefaultDirectoryPort } from "../../node/file-system/file-system-port.ts";
import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { readBoundCatalogue } from "./bound-catalogue.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { IMPORTED_PARTY_SYMPTOMS, RUNTIME_REACH } from "../../../domain/records/answering/record-reach.ts";
import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";

const NAMED_BY_RECORD_REACH: readonly string[] = [...IMPORTED_PARTY_SYMPTOMS, ...Object.values(RUNTIME_REACH).flat()];

const symptomNamesOf = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] =>
  request.catalogue.symptoms.map((symptom) => symptom.name);

const symptomsNamedByRecordReachButNotCatalogued = (request: { readonly catalogue: SymptomCatalogue }): readonly string[] => {
  const catalogued = symptomNamesOf(request);
  return NAMED_BY_RECORD_REACH.filter((name) => !catalogued.includes(name));
};

const REPO_ROOT = absolutePathSchema.parse(createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/../../..`, ".."] }));

const reading = readBoundCatalogue({ directory: createDefaultDirectoryPort({}), fileText: createDefaultFileTextPort({}), path: createDefaultPathPort({}), ruleSetRoot: REPO_ROOT, installRoot: REPO_ROOT });

describe("symptomsNamedByRecordReachButNotCatalogued over a written-out catalogue, so the guard can fail", () => {
  it("lists every symptom a record's reach names when the catalogue holds none", () => {
    expect(
      symptomsNamedByRecordReachButNotCatalogued({
        catalogue: {
          principles: [],
          rules: [],
          cases: [],
          recipes: [],
          recordKinds: [
            { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
            { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" },
          ],
          alwaysRecordable: {
            debt: { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" },
            authorisedLocation: { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" },
          },
          engines: [],
          symptoms: [],
          clauses: [],
          checks: [],
          namedBans: [],
        },
      }),
    ).toEqual([
      "outside-import-past-a-boundary",
      "library-class-built-in-place",
      "outside-type-in-a-signature",
      "date-used-directly",
      "ambient-randomness",
      "process-global-used-in-place",
      "text-past-its-reader",
    ]);
  });
});

describe("the symptoms a record's reach names", () => {
  it("are all symptoms of the catalogue the tool ships", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    expect(symptomsNamedByRecordReachButNotCatalogued({ catalogue: reading.value.catalogue })).toEqual([]);
  });
});
