import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { assert, describe, expect, it, vi } from "vitest";
import { createSelectionRepository, readRunSettings } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { readBoundCatalogue } from "../infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "..", ".."] }) });

const PAIR_ROOT = path.join({ segments: [import.meta.dirname, "settings-pair"] });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "after"] }) });

const toolCatalogue = (): SymptomCatalogue => {
  const reading = readBoundCatalogue({ directory: createDefaultDirectoryPort({}), fileText, path, ruleSetRoot: INSTALL_ROOT, installRoot: INSTALL_ROOT });
  assert(reading.outcome === "ok", "this repository's catalogue reads");
  assert(reading.value.held === "catalogue", "this repository holds a catalogue");
  return reading.value.catalogue;
};

const readBefore = () => {
  const reading = createSelectionRepository({ repoRoot: BEFORE_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path }).read({});
  assert(reading.outcome === "ok", "the plan's version 1 file loads");
  return reading.value;
};

const readBeforeRunSettings = () => {
  const reading = readRunSettings({ fileText, path, repoRoot: BEFORE_ROOT });
  assert(reading.outcome === "ok", "the plan's version 1 run settings load");
  return reading.value;
};

const readAfter = () => {
  const stages = versionTwoStagesOver({
    ports: {
      fileText,
      path,
      modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
      engine: createDefaultEnginePort({}),
      git: {
        trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
        changedSince: vi.fn<GitPort["changedSince"]>(),
        contentInBase: vi.fn<GitPort["contentInBase"]>(),
        textInBase: vi.fn<GitPort["textInBase"]>(),
        renamedSince: vi.fn<GitPort["renamedSince"]>(),
      },
      gitTree: { pathsAt: vi.fn<GitTreePort["pathsAt"]>() },
      directory: createDefaultDirectoryPort({}),
      recordsSourceOf: vi.fn<RecordsSourceOf>(),
    },
    locations: { repoRoot: AFTER_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", baseRevision: undefined },
  });
  const reading = stages.settings({ catalogue: toolCatalogue() });
  assert(reading.outcome === "ok", "the plan's version 2 file loads");
  return reading.value;
};

describe("the plan's version 1 and version 2 files through the settings pipeline", () => {
  it("give the same bindings, each with its clause settings, edition, anchor and piece root", () => {
    expect(readAfter().selection.bindings).toEqual(readBefore().bindings);
  });

  it("give the same selected clauses, clause roots, not-adopted clauses, not-run clauses, editions and excluded paths", () => {
    const before = readBefore();
    const after = readAfter();
    expect({
      selected: after.selection.selection.selected,
      clauseRoots: after.selection.clauseRoots,
      notAdopted: after.selection.selection.notAdopted,
      notRun: after.selection.selection.notRun,
      editions: after.selection.selection.editions,
      excluded: after.selection.excluded,
    }).toEqual({
      selected: before.selection.selected,
      clauseRoots: before.clauseRoots,
      notAdopted: before.selection.notAdopted,
      notRun: before.selection.notRun,
      editions: before.selection.editions,
      excluded: before.excluded,
    });
  });

  it("give the same run settings", () => {
    expect(readAfter().runSettings).toEqual(readBeforeRunSettings());
  });

  it("offers as available every check of a listed symptom that is listed nowhere, and leaves the selection without an uncovered field", () => {
    const after = readAfter();
    expect(after.selection.selection).not.toHaveProperty("uncovered");
    expect({ available: after.available }).toMatchObject({
      available: [
        { name: "cast-to-any", clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-1"), clause: clauseIdOf("any-cast") } },
        { name: "stub-implementation", clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-25"), clause: clauseIdOf("dependency-isolation") } },
        { name: "parameter-reassignment", clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-44"), clause: clauseIdOf("parameter-reassignment") } },
        { name: "throw-statement", clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-10"), clause: clauseIdOf("throws-in-tests") } },
      ],
    });
  });

  it("requires every record's why-chain in version 2, where version 1 left it optional", () => {
    expect({ before: readBefore().fileExceptionWhyChains, after: readAfter().selection.fileExceptionWhyChains }).toEqual({
      before: "optional",
      after: "required",
    });
  });
});
