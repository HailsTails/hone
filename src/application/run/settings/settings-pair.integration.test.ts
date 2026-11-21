import { assert, describe, expect, it } from "vitest";
import { createSelectionRepository, readRunSettings } from "../../../infrastructure/disciplines-file/consumer-selection.ts";
import { createDefaultFileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../infrastructure/node/path-port.ts";
import { createSettingsRepository } from "./read-settings.ts";
import { createSettingsSources } from "../../../infrastructure/hone-config-file/settings-sources.ts";
import type { AbsolutePath } from "../../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { repositoryRootOf } from "../../../../tests/allowed-forms-proof.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: repositoryRootOf({ testFolder: `${import.meta.dirname}/../../..` }) });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "settings-pair", "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "settings-pair", "after"] }) });

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
  const sources = createSettingsSources({ repoRoot: AFTER_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path });
  const reading = createSettingsRepository({ sources }).read({});
  assert(reading.outcome === "ok", "the plan's version 2 file loads");
  return reading.value;
};

describe("the plan's version 1 and version 2 files", () => {
  it("give the same bindings", () => {
    expect(readAfter().selection.bindings).toEqual(readBefore().bindings);
  });

  it("give the same selected clauses, clause roots, not-adopted clauses and editions", () => {
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

  it("names as uncovered, per symptom, every clause whose check of a listed symptom is listed nowhere", () => {
    expect(readAfter().selection.selection.uncovered).toEqual([
      clauseAddressSchema.parse("CD-1#any-cast"),
      clauseAddressSchema.parse("CD-10#throws-in-tests"),
      clauseAddressSchema.parse("CD-25#dependency-isolation"),
      clauseAddressSchema.parse("CD-44#parameter-reassignment"),
    ]);
  });

  it("requires every record's why-chain in version 2, where version 1 left it optional", () => {
    expect({ before: readBefore().fileExceptionWhyChains, after: readAfter().selection.fileExceptionWhyChains }).toEqual({
      before: "optional",
      after: "required",
    });
  });
});
