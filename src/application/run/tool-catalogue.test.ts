import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { SymptomCatalogueOf, SymptomCatalogueRepository } from "../ports/symptom-catalogue-repository.ts";
import { toolCatalogueOf } from "./tool-catalogue.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";

const INSTALL = absoluteRootOf("/install");

const CATALOGUE_PATH = "/install/rules/typescript/symptoms.json";

const POSIX: Pick<PathPort, "join"> = { join: vi.fn<PathPort["join"]>().mockReturnValue(CATALOGUE_PATH) };

const FILE_TEXT: FileTextPort = {
  exists: vi.fn<FileTextPort["exists"]>(),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const cataloguesReading = (read: SymptomCatalogueRepository["read"]): SymptomCatalogueOf => () => ({ read });

const catalogueOver = (request: { readonly read: SymptomCatalogueRepository["read"] }) =>
  toolCatalogueOf({ symptomCatalogueOf: cataloguesReading(request.read), fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL });

describe("toolCatalogueOf", () => {
  it("asks for the catalogue of the install's rule set through the file text and path it is given", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValue({ read: () => ({ outcome: "ok", value: { held: "none" } }) });
    toolCatalogueOf({ symptomCatalogueOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL });
    expect(symptomCatalogueOf.mock.calls).toEqual([[{ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: INSTALL }]]);
  });

  it("fails as a catalogue not read, absent, when the install holds no catalogue", () => {
    expect(catalogueOver({ read: () => ({ outcome: "ok", value: { held: "none" } }) })).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "absent" } },
    });
  });

  it("fails as a catalogue not read, unreadable, with the reader's words when the file cannot be read", () => {
    expect(catalogueOver({ read: () => ({ outcome: "failed", error: { kind: "file-unreadable", path: CATALOGUE_PATH, detail: "EACCES" } }) })).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "unreadable", detail: "EACCES" } },
    });
  });

  it("fails as a catalogue not read, unreadable, when the file is not JSON", () => {
    expect(
      catalogueOver({ read: () => ({ outcome: "failed", error: { kind: "file-malformed", path: CATALOGUE_PATH, detail: "Unexpected end of JSON input" } }) }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "unreadable", detail: "Unexpected end of JSON input" } },
    });
  });
});
