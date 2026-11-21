import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import type { RecordKind, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { SymptomCatalogueRepository } from "../../../application/ports/symptom-catalogue-repository.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { type SymptomCatalogueOf, symptomGuideIn } from "./symptom-guide.ts";

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const REPO_ROOT = absolutePathSchema.parse("/repo");

const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/@hailstails/hone");

const FILE_TEXT: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>(),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("symptomGuideIn", () => {
  it("reads the installed catalogue and points at its page as the repository shows it", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "catalogue", catalogue: CATALOGUE } }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "catalogue", catalogue: CATALOGUE, page: "node_modules/@hailstails/hone/rules/typescript/symptoms.md" });
  });

  it("asks for the catalogue under the install root, through the ports it is given", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "none" } }),
    };
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValue(repository);

    symptomGuideIn({ path: POSIX, fileText: FILE_TEXT, repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, symptomCatalogueOf });

    expect(symptomCatalogueOf).toHaveBeenCalledExactlyOnceWith({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: "/repo/node_modules/@hailstails/hone" });
  });

  it("gives no guide when the install holds no catalogue", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({ outcome: "ok", value: { held: "none" } }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "none" });
  });

  it("gives a guide that says why the catalogue was not read, naming it as the repository shows it", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "file-malformed", path: "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "Unexpected end" },
      }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "unreadable", failure: "file-malformed node_modules/@hailstails/hone/rules/typescript/symptoms.json Unexpected end" });
  });

  it("gives a guide that says the catalogue could not be read from disk, naming it as the repository shows it", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "file-unreadable", path: "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms.json", detail: "EACCES" },
      }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "unreadable", failure: "file-unreadable node_modules/@hailstails/hone/rules/typescript/symptoms.json EACCES" });
  });

  it("gives a guide that names the catalogue's version when it is one this release does not read", () => {
    const repository: SymptomCatalogueRepository = {
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unsupported-version", path: "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms.json", found: 2 },
      }),
    };

    expect(
      symptomGuideIn({
        path: POSIX,
        fileText: FILE_TEXT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        symptomCatalogueOf: vi.fn<SymptomCatalogueOf>().mockReturnValue(repository),
      }),
    ).toEqual({ guide: "unreadable", failure: "unsupported-version node_modules/@hailstails/hone/rules/typescript/symptoms.json 2" });
  });
});
