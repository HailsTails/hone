import { assert, describe, expect, it, vi } from "vitest";

import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { RecordsSourceOf } from "../application/ports/records/records-source-of.ts";
import { checkAddressTextOf } from "../domain/language-layer/check-address-text.ts";
import type { SymptomCatalogue } from "../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { sameClauseAddress, TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { readBoundCatalogue } from "../infrastructure/content-files/symptom-catalogues/bound-catalogue.ts";
import {
  createSelectionRepository,
  readRunSettings,
} from "../infrastructure/disciplines-file/consumer-selection.ts";
import { createNamedEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { statedAuthorisedLocationWireSchema } from "../infrastructure/hone-records-folder/records-wire.ts";
import { createDefaultDirectoryPort } from "../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import { versionTwoStagesOver } from "./version-two-stages.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({
  path: path.join({ segments: [import.meta.dirname, "..", ".."] }),
});

const PAIR_ROOT = path.join({ segments: [import.meta.dirname, "settings-pair"] });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [PAIR_ROOT, "after"] }) });

const toolCatalogue = (): SymptomCatalogue => {
  const reading = readBoundCatalogue({
    ruleSet: "hone",
    directory: createDefaultDirectoryPort({}),
    fileText,
    path,
    ruleSetRoot: INSTALL_ROOT,
    installRoot: INSTALL_ROOT,
  });
  assert(reading.outcome === "ok", "this repository's catalogue reads");
  assert(reading.value.held === "catalogue", "this repository holds a catalogue");
  return reading.value.catalogue;
};

const readBefore = () => {
  const reading = createSelectionRepository({
    repoRoot: BEFORE_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    fileText,
    path,
  }).read({});
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
      namedEngine: createNamedEnginePort({}),
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
    locations: {
      repoRoot: AFTER_ROOT,
      installRoot: INSTALL_ROOT,
      moduleExtension: ".ts",
      baseRevision: undefined,
    },
  });
  const reading = stages.settings({ catalogue: toolCatalogue() });
  assert(reading.outcome === "ok", "the plan's version 2 file loads");
  return reading.value;
};

describe("the plan's version 1 and version 2 files through the settings pipeline", () => {
  it("give the same bindings, each with its clause settings, edition, anchor and piece root", () => {
    const before = readBefore();
    const expected = before.bindings.flatMap(({ mechanism, clause }) => {
      const root = before.clauseRoots.find(
        ({ clause: address }) =>
          sameClauseAddress({ left: address, right: clause.address }) === "same",
      );
      assert.isDefined(root);
      return root.checks.map((check) => ({
        address: checkAddressTextOf({ check }),
        engine: mechanism,
        anchor: clause.anchor,
        pieceRoot: clause.pieceRoot,
        settings: clause.settings,
        checkSettings: clause.clauseSettings ?? {},
        edition: clause.edition,
      }));
    });
    const bindings = readAfter().selection.selected.map(({ binding }) => ({
      address: binding.address,
      engine: binding.engine,
      anchor: binding.anchor,
      pieceRoot: binding.pieceRoot,
      settings: binding.settings,
      checkSettings: binding.checkSettings,
      edition: binding.edition,
    }));
    expect(bindings.toSorted((left, right) => left.address.localeCompare(right.address))).toEqual(
      expected.toSorted((left, right) => left.address.localeCompare(right.address)),
    );
  });

  it("give the same selected clauses, clause roots, not-adopted clauses, not-run clauses, editions and excluded paths", () => {
    const before = readBefore();
    const after = readAfter();
    const represented = after.selection.selected.filter(
      ({ check }, index, all) =>
        all.findIndex(
          ({ check: earlier }) =>
            earlier.clause !== undefined &&
            check.clause !== undefined &&
            sameClauseAddress({ left: earlier.clause, right: check.clause }) === "same",
        ) === index,
    );
    expect({
      selected: represented.map(({ check, binding, exceptions }) => ({
        address: check.clause,
        mechanism: binding.engine,
        exceptions,
      })),
      notAdopted: after.selection.notAdopted.map(({ check }) => check.clause),
      notRun: after.selection.notRun.map(({ check }) => check.clause),
      editions: represented
        .filter(({ editions }) => editions.declared.length > 1)
        .map(({ check, binding, editions }) => ({
          address: check.clause,
          mechanism: binding.engine,
          edition: binding.edition,
          latest: editions.latest,
        })),
      excluded: after.selection.excluded,
    }).toEqual({
      selected: before.selection.selected,
      notAdopted: before.selection.notAdopted,
      notRun: before.selection.notRun,
      editions: before.selection.editions,
      excluded: before.excluded,
    });
    expect(represented.map(({ check }) => check.clause)).toEqual(
      before.clauseRoots.map(({ clause }) => clause),
    );
  });

  it("give the same run settings", () => {
    expect(readAfter().runSettings).toEqual(readBeforeRunSettings());
  });

  it("offers as available every check of a listed symptom that is listed nowhere, and leaves the selection without an uncovered field", () => {
    const after = readAfter();
    expect(after.selection).not.toHaveProperty("uncovered");
    expect({ available: after.available }).toMatchObject({
      available: [
        {
          name: "cast-to-any",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-1"),
            clause: clauseIdOf("any-cast"),
          },
        },
        {
          name: "stub-implementation",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-25"),
            clause: clauseIdOf("dependency-isolation"),
          },
        },
        {
          name: "parameter-reassignment",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-44"),
            clause: clauseIdOf("parameter-reassignment"),
          },
        },
        {
          name: "throw-statement",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-10"),
            clause: clauseIdOf("throws-in-tests"),
          },
        },
      ],
    });
  });

  it("requires every record's why-chain in version 2, where version 1 left it optional", () => {
    expect(readBefore().fileExceptionWhyChains).toBe("optional");
    const result = statedAuthorisedLocationWireSchema.safeParse({
      answers: "claimed-type#unlisted-cast-site",
      file: "src/authorised.ts",
      case: "gives-a-value-its-type",
      owes: "declared-not-asserted",
    });
    assert(result.success === false);
    expect(result.error.issues.map(({ path }) => path)).toEqual([["whyChain"]]);
  });
});
