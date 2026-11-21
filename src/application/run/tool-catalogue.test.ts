import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { toolCatalogueOf } from "./tool-catalogue.ts";
import { createSymptomCatalogueRepository } from "../../infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";

const INSTALL = absolutePathSchema.parse("/install");

const CATALOGUE_PATH = "/install/rules/typescript/symptoms.json";

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const catalogueOver = (request: { readonly fileText: FileTextPort }) => toolCatalogueOf({ symptomCatalogueOf: createSymptomCatalogueRepository, fileText: request.fileText, path: POSIX, installRoot: INSTALL });

const filesHolding = (request: { readonly text: string }): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  write: vi.fn<FileTextPort["write"]>(),
});

describe("toolCatalogueOf", () => {
  it("fails as a catalogue not read, absent, when the install holds no catalogue", () => {
    const absent: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(catalogueOver({ fileText: absent })).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "absent" } },
    });
  });

  it("fails as a catalogue not read, unreadable, with the reader's words when the file cannot be read", () => {
    const unreadable: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: CATALOGUE_PATH, detail: "EACCES" } }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(catalogueOver({ fileText: unreadable })).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "unreadable", detail: "EACCES" } },
    });
  });

  it("fails as a catalogue not read, unreadable, when the file is not JSON", () => {
    expect(catalogueOver({ fileText: filesHolding({ text: "{" }) })).toMatchObject({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "unreadable" } },
    });
  });
});
