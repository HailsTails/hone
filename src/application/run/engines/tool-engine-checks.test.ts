import { describe, expect, it, vi } from "vitest";

import type { SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { BoundCatalogueOf } from "../../ports/symptom-catalogue-repository.ts";
import { mapToolCatalogueToEngineChecks } from "./tool-engine-checks.ts";

const INSTALL = absoluteRootOf("/install");

const POSIX: Pick<PathPort, "join"> = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/install/rules"),
};

const FILE_TEXT: FileTextPort = {
  exists: vi.fn<FileTextPort["exists"]>(),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [{ name: "walker" }],
  symptoms: [
    {
      ruleSet: "hone",
      name: "loop-keyword",
      title: "Loop keyword",
      seen: "a loop keyword",
      mayIndicate: [],
      breachUsuallySits: "in a loop",
      recipes: [],
      correctUses: [],
    },
  ],
  clauses: [],
  checks: [
    {
      name: "for-of",
      symptom: { ruleSet: "hone", name: "loop-keyword" },
      page: "loop-keyword/for-of.md",
      forms: [],
      engines: [{ name: "walker" }],
    },
  ],
  namedBans: [],
};

describe("mapToolCatalogueToEngineChecks", () => {
  it("gives the install's checks with the title of each symptom", () => {
    const boundCatalogueOf = vi
      .fn<BoundCatalogueOf>()
      .mockReturnValueOnce({ outcome: "ok", value: { held: "catalogue", catalogue: CATALOGUE } });

    const checks = mapToolCatalogueToEngineChecks({
      boundCatalogueOf,
      fileText: FILE_TEXT,
      path: POSIX,
      installRoot: INSTALL,
    });

    expect(checks).toEqual({
      outcome: "ok",
      value: [
        {
          name: "for-of",
          symptom: { ruleSet: "hone", name: "loop-keyword", title: "Loop keyword" },
          engines: [{ name: "walker" }],
        },
      ],
    });
  });

  it("fails as a catalogue not read when the install holds no catalogue", () => {
    const boundCatalogueOf = vi
      .fn<BoundCatalogueOf>()
      .mockReturnValueOnce({ outcome: "ok", value: { held: "none" } });

    const checks = mapToolCatalogueToEngineChecks({
      boundCatalogueOf,
      fileText: FILE_TEXT,
      path: POSIX,
      installRoot: INSTALL,
    });

    expect(checks).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: "/install/rules", reason: { reason: "absent" } },
    });
  });

  it("fails naming the symptom a check names and the catalogue does not hold", () => {
    const boundCatalogueOf = vi.fn<BoundCatalogueOf>().mockReturnValueOnce({
      outcome: "ok",
      value: { held: "catalogue", catalogue: { ...CATALOGUE, symptoms: [] } },
    });

    const checks = mapToolCatalogueToEngineChecks({
      boundCatalogueOf,
      fileText: FILE_TEXT,
      path: POSIX,
      installRoot: INSTALL,
    });

    expect(checks).toEqual({
      outcome: "failed",
      error: { kind: "symptom-unheld", symptom: { ruleSet: "hone", name: "loop-keyword" } },
    });
  });
});
