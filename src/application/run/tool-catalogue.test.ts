import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { SymptomCatalogueOf, SymptomCatalogueRepository } from "../ports/symptom-catalogue-repository.ts";
import type { EngineBindingsOf, EngineBindingsRepository } from "../ports/engine-bindings-repository.ts";
import type { CatalogueContent, RecordKind, Symptom } from "../../domain/language-layer/symptom-catalogue.ts";
import { toolCatalogueOf } from "./tool-catalogue.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";

const INSTALL = absoluteRootOf("/install");

const CATALOGUE_PATH = "/install/rules";

const POSIX: Pick<PathPort, "join"> = { join: vi.fn<PathPort["join"]>().mockReturnValue(CATALOGUE_PATH) };

const FILE_TEXT: FileTextPort = {
  exists: vi.fn<FileTextPort["exists"]>(),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

const cataloguesReading = (read: SymptomCatalogueRepository["read"]): SymptomCatalogueOf => () => ({ read });

const NO_BINDINGS: EngineBindingsOf = () => ({ read: vi.fn<EngineBindingsRepository["read"]>().mockReturnValue({ outcome: "ok", value: new Map() }) });

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = { name: "authorised-location", title: "Authorised location", phrase: "an authorised location", todaysFormat: "authorised-location" };

const DATE_USED_DIRECTLY: Symptom = {
  name: "date-used-directly",
  title: "Date used directly",
  seen: "Any use of Date.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CONTENT: CatalogueContent = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT, AUTHORISED_LOCATION],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [],
  symptoms: [DATE_USED_DIRECTLY],
  clauses: [],
  checks: [{ name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-17"), clause: clauseIdOf("clock-sources") }, forms: [] }],
  namedBans: [],
};

const catalogueOver = (request: { readonly read: SymptomCatalogueRepository["read"] }) =>
  toolCatalogueOf({ symptomCatalogueOf: cataloguesReading(request.read), engineBindingsOf: NO_BINDINGS, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL });

describe("toolCatalogueOf", () => {
  it("asks for the catalogue of the install's rule set through the file text and path it is given", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValue({ read: () => ({ outcome: "ok", value: { held: "none" } }) });
    toolCatalogueOf({ symptomCatalogueOf, engineBindingsOf: NO_BINDINGS, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL });
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

  it("fails as a catalogue not read, unreadable, naming each check whose clause no piece runs", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValueOnce({
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: { held: "catalogue", content: CONTENT } }),
    });
    const engineBindingsOf = vi.fn<EngineBindingsOf>().mockReturnValueOnce({
      read: vi.fn<EngineBindingsRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: new Map() }),
    });
    expect(toolCatalogueOf({ symptomCatalogueOf, engineBindingsOf, fileText: FILE_TEXT, path: POSIX, installRoot: INSTALL })).toEqual({
      outcome: "failed",
      error: {
        kind: "catalogue-not-read",
        path: CATALOGUE_PATH,
        reason: { reason: "unreadable", detail: "no piece runs the clause of date-used-directly#clock-sources" },
      },
    });
    expect(engineBindingsOf).toHaveBeenCalledWith({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: INSTALL, installRoot: INSTALL });
  });
});
