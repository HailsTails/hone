import { describe, expect, it, vi } from "vitest";
import { pieceClauseKeyOf } from "../../domain/language-layer/catalogue-binding.ts";
import type { CatalogueContent, CheckContent, Engine, RecordKind, Symptom } from "../../domain/language-layer/symptom-catalogue.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { createPathPort } from "../../infrastructure/node/path-port.ts";
import type { EngineBindingsOf, EngineBindingsRepository } from "../ports/engine-bindings-repository.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { SymptomCatalogueOf, SymptomCatalogueRepository } from "../ports/symptom-catalogue-repository.ts";
import { boundCatalogueOf } from "./bound-catalogue.ts";

const INSTALL = absolutePathSchema.parse("/install");

const TEAM = absolutePathSchema.parse("/repo/team-rules");

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const FILE_TEXT: FileTextPort = { exists: vi.fn<FileTextPort["exists"]>(), read: vi.fn<FileTextPort["read"]>(), write: vi.fn<FileTextPort["write"]>() };

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

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

const CLOCK_SOURCES = clauseAddressSchema.parse("CD-17#clock-sources");

const CLOCK_SOURCES_CHECK: CheckContent = { name: "clock-sources", symptom: DATE_USED_DIRECTLY, clause: CLOCK_SOURCES, forms: [] };

const CONTENT: CatalogueContent = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [DEBT, AUTHORISED_LOCATION],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [WALKER],
  symptoms: [DATE_USED_DIRECTLY],
  clauses: [],
  checks: [CLOCK_SOURCES_CHECK],
  namedBans: [],
};

describe("boundCatalogueOf", () => {
  it("reads the rule set's content and the pieces beside it, and gives each check the engines of the pieces that run its clause", () => {
    const contentRead = vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: { held: "catalogue", content: CONTENT } });
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValueOnce({ read: contentRead });
    const bindingsRead = vi.fn<EngineBindingsRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: new Map([[pieceClauseKeyOf(CLOCK_SOURCES), [WALKER]]]) });
    const engineBindingsOf = vi.fn<EngineBindingsOf>().mockReturnValueOnce({ read: bindingsRead });

    expect(boundCatalogueOf({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: TEAM, installRoot: INSTALL, symptomCatalogueOf, engineBindingsOf })).toEqual({
      outcome: "ok",
      value: { held: "catalogue", catalogue: { ...CONTENT, checks: [{ ...CLOCK_SOURCES_CHECK, engines: [WALKER] }] } },
    });
    expect(symptomCatalogueOf).toHaveBeenCalledWith({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: TEAM });
    expect(engineBindingsOf).toHaveBeenCalledWith({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: TEAM, installRoot: INSTALL });
  });

  it("holds none when the rule set holds no catalogue", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValueOnce({
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: { held: "none" } }),
    });
    const engineBindingsOf = vi.fn<EngineBindingsOf>().mockReturnValueOnce({
      read: vi.fn<EngineBindingsRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: new Map() }),
    });

    expect(boundCatalogueOf({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: INSTALL, installRoot: INSTALL, symptomCatalogueOf, engineBindingsOf })).toEqual({
      outcome: "ok",
      value: { held: "none" },
    });
  });

  it("fails as the content reader fails, reading no pieces", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValueOnce({
      read: vi
        .fn<SymptomCatalogueRepository["read"]>()
        .mockReturnValueOnce({ outcome: "failed", error: { kind: "file-unreadable", path: "/install/rules", detail: "EACCES" } }),
    });
    const engineBindingsOf = vi.fn<EngineBindingsOf>();

    expect(boundCatalogueOf({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: INSTALL, installRoot: INSTALL, symptomCatalogueOf, engineBindingsOf })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/install/rules", detail: "EACCES" },
    });
    expect(engineBindingsOf).not.toHaveBeenCalled();
  });

  it("fails as the piece reader fails", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValueOnce({
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: { held: "catalogue", content: CONTENT } }),
    });
    const engineBindingsOf = vi.fn<EngineBindingsOf>().mockReturnValueOnce({
      read: vi
        .fn<EngineBindingsRepository["read"]>()
        .mockReturnValueOnce({ outcome: "failed", error: { kind: "file-malformed", path: "/install/src/infrastructure/engines/audit/CD-17/piece.json", detail: "✖ bad" } }),
    });

    expect(boundCatalogueOf({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: INSTALL, installRoot: INSTALL, symptomCatalogueOf, engineBindingsOf })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/install/src/infrastructure/engines/audit/CD-17/piece.json", detail: "✖ bad" },
    });
  });

  it("fails as a malformed catalogue, naming its rules folder, when no piece runs the clause of a check", () => {
    const symptomCatalogueOf = vi.fn<SymptomCatalogueOf>().mockReturnValueOnce({
      read: vi.fn<SymptomCatalogueRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: { held: "catalogue", content: CONTENT } }),
    });
    const engineBindingsOf = vi.fn<EngineBindingsOf>().mockReturnValueOnce({
      read: vi.fn<EngineBindingsRepository["read"]>().mockReturnValueOnce({ outcome: "ok", value: new Map() }),
    });

    expect(boundCatalogueOf({ fileText: FILE_TEXT, path: POSIX, ruleSetRoot: TEAM, installRoot: INSTALL, symptomCatalogueOf, engineBindingsOf })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: "/repo/team-rules/rules", detail: "no piece runs the clause of date-used-directly#clock-sources" },
    });
  });
});
