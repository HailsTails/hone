import { describe, expect, it } from "vitest";

import { createDefaultDirectoryPort } from "../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../absolute-path.ts";
import { readBoundCatalogue } from "./bound-catalogue.ts";

const REPO_ROOT = absolutePathSchema.parse(
  createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/../../..`, ".."] }),
);

const reading = readBoundCatalogue({
  ruleSet: "hone",
  inheritedRecordKinds: [],
  directory: createDefaultDirectoryPort({}),
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  ruleSetRoot: REPO_ROOT,
  installRoot: REPO_ROOT,
});

describe("rules/typescript/symptoms.json, read from this repository through the catalogue's reader", () => {
  it("reads into the typed catalogue", () => {
    expect(reading).toMatchObject({ outcome: "ok", value: { held: "catalogue" } });
  });
});
