import { describe, expect, it, vi } from "vitest";

import type {
  RecordKind,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { BoundCatalogueOf } from "../ports/symptom-catalogue-repository.ts";
import { toolCatalogueOf } from "./tool-catalogue.ts";

const INSTALL = absoluteRootOf("/install");

const CATALOGUE_PATH = "/install/rules";

const POSIX: Pick<PathPort, "join"> = {
  join: vi.fn<PathPort["join"]>().mockReturnValue(CATALOGUE_PATH),
};

const FILE_TEXT: FileTextPort = {
  exists: vi.fn<FileTextPort["exists"]>(),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
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
  recordKinds: [DEBT, AUTHORISED_LOCATION],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

describe("toolCatalogueOf", () => {
  it("gives the install's catalogue, bound under the install root as Hone's own rule set through the port it is given", () => {
    const boundCatalogueOf = vi
      .fn<BoundCatalogueOf>()
      .mockReturnValueOnce({ outcome: "ok", value: { held: "catalogue", catalogue: CATALOGUE } });
    expect(
      toolCatalogueOf({ boundCatalogueOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL }),
    ).toEqual({ outcome: "ok", value: CATALOGUE });
    expect(boundCatalogueOf).toHaveBeenCalledExactlyOnceWith({
      fileText: FILE_TEXT,
      path: POSIX,
      ruleSetRoot: INSTALL,
      ruleSet: "hone",
      installRoot: INSTALL,
      inheritedRecordKinds: [],
    });
  });

  it("fails as a catalogue not read, absent, when the install holds no catalogue", () => {
    const boundCatalogueOf = vi
      .fn<BoundCatalogueOf>()
      .mockReturnValueOnce({ outcome: "ok", value: { held: "none" } });
    expect(
      toolCatalogueOf({ boundCatalogueOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "catalogue-not-read", path: CATALOGUE_PATH, reason: { reason: "absent" } },
    });
  });

  it("fails as a catalogue not read, unreadable, with the reader's words when the catalogue cannot be read", () => {
    const boundCatalogueOf = vi.fn<BoundCatalogueOf>().mockReturnValueOnce({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        path: "/install/src/infrastructure/disciplines-file/version-one-names.json",
        detail: "EACCES",
      },
    });
    expect(
      toolCatalogueOf({ boundCatalogueOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "catalogue-not-read",
        path: CATALOGUE_PATH,
        reason: { reason: "unreadable", detail: "EACCES" },
      },
    });
  });

  it("fails as a catalogue not read, unreadable, naming each check whose clause no piece runs", () => {
    const boundCatalogueOf = vi.fn<BoundCatalogueOf>().mockReturnValueOnce({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: CATALOGUE_PATH,
        detail: "no piece runs the clause of date-used-directly#clock-sources",
      },
    });
    expect(
      toolCatalogueOf({ boundCatalogueOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "catalogue-not-read",
        path: CATALOGUE_PATH,
        reason: {
          reason: "unreadable",
          detail: "no piece runs the clause of date-used-directly#clock-sources",
        },
      },
    });
  });

  it("fails as a catalogue not read, unreadable, naming the kind of a failure that carries no words", () => {
    const boundCatalogueOf = vi.fn<BoundCatalogueOf>().mockReturnValueOnce({
      outcome: "failed",
      error: { kind: "unsupported-version", path: CATALOGUE_PATH, found: 2 },
    });
    expect(
      toolCatalogueOf({ boundCatalogueOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "catalogue-not-read",
        path: CATALOGUE_PATH,
        reason: { reason: "unreadable", detail: "unsupported-version" },
      },
    });
  });
});
