import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { repositoryRootOf } from "../../../../tests/allowed-forms-proof.ts";
import { symptomsNamedByRecordReachButNotCatalogued } from "../../../../tests/symptom-catalogue-coverage.ts";

const REPO_ROOT = absolutePathSchema.parse(repositoryRootOf({ testFolder: `${import.meta.dirname}/../../..` }));

const reading = createSymptomCatalogueRepository({ fileText: createDefaultFileTextPort({}), path: createDefaultPathPort({}), ruleSetRoot: REPO_ROOT }).read({});

describe("the symptoms a record's reach names", () => {
  it("are all symptoms of the catalogue the tool ships", () => {
    assert(reading.outcome === "ok");
    assert(reading.value.held === "catalogue");
    expect(symptomsNamedByRecordReachButNotCatalogued({ catalogue: reading.value.catalogue })).toEqual([]);
  });
});
