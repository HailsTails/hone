import { assert, describe, expect, it } from "vitest";
import { createSelectionRepository, readRunSettings } from "../disciplines-file/consumer-selection.ts";
import { createDefaultFileTextPort } from "../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../node/path-port.ts";
import { createSettingsSources } from "./settings-sources.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { SettingsFile } from "../../domain/settings/settings-file.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";
import { SETTINGS_FILE_FORMAT } from "./settings-file.ts";
import { mechanismIdSchema } from "./identifiers.ts";

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "..", "..", ".."] }) });

const BEFORE_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "settings-pair", "before"] }) });

const AFTER_ROOT = resolvedPath({ path: path.join({ segments: [import.meta.dirname, "settings-pair", "after"] }) });

const CLAUSES_RUN = [
  clauseAddressSchema.parse("CD-17#clock-sources"),
  clauseAddressSchema.parse("CD-2#cast-expressions"),
  clauseAddressSchema.parse("CD-2#non-null-assertions"),
  clauseAddressSchema.parse("CD-5#comments-directives"),
  clauseAddressSchema.parse("CD-19#import-boundaries"),
  clauseAddressSchema.parse("CD-27#test-body-logic"),
];

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const MECHANISMS_RUN = [AUDIT, AUDIT, ESLINT, AUDIT, AUDIT, AUDIT];

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

const afterSources = () => createSettingsSources({ repoRoot: AFTER_ROOT, installRoot: INSTALL_ROOT, moduleExtension: ".ts", fileText, path });

const readAfterFile = (): SettingsFile => {
  const document = afterSources().settingsFile({});
  assert(document.outcome === "ok", "the plan's version 2 file is found");
  const file = SETTINGS_FILE_FORMAT.fileOf({ document: document.value.document });
  assert(file.outcome === "ok", "the plan's version 2 file loads");
  return file.value;
};

const readAfterPiece = (request: { readonly index: number }) => {
  const piece = afterSources().pieceClause({
    ruleSetRoot: INSTALL_ROOT,
    clause: CLAUSES_RUN[request.index],
    mechanism: MECHANISMS_RUN[request.index],
  });
  assert(piece.outcome === "ok", `the piece of clause ${request.index} loads from version 2`);
  return piece.value;
};

describe("the plan's version 1 and version 2 files", () => {
  it("exclude the same paths", () => {
    expect({ before: readBefore().excluded, after: readAfterFile().exclude }).toEqual({ before: ["vendor"], after: ["vendor"] });
  });

  it("give the same run settings", () => {
    expect({ forfeiture: readAfterFile().forfeiture, reportOutput: readAfterFile().reportOutput }).toEqual({
      forfeiture: readBeforeRunSettings().assessment.forfeiture,
      reportOutput: readBeforeRunSettings().reportOutput,
    });
  });

  it("run the same clauses through the same mechanisms", () => {
    expect(readBefore().selection.selected).toMatchObject([
      { address: clauseAddressSchema.parse("CD-17#clock-sources"), mechanism: "audit" },
      { address: clauseAddressSchema.parse("CD-2#cast-expressions"), mechanism: "audit" },
      { address: clauseAddressSchema.parse("CD-2#non-null-assertions"), mechanism: "eslint" },
      { address: clauseAddressSchema.parse("CD-5#comments-directives"), mechanism: "audit" },
      { address: clauseAddressSchema.parse("CD-19#import-boundaries"), mechanism: "audit" },
      { address: clauseAddressSchema.parse("CD-27#test-body-logic"), mechanism: "audit" },
    ]);
  });

  it.each([0, 1, 2, 3, 4, 5])("bind run clause %s to the same piece folder, anchor and piece settings", (index) => {
    const piece = readAfterPiece({ index });
    const binding = readBefore().bindings[index];
    assert.isDefined(binding, `version 1 binds run clause ${index}`);
    expect({ anchor: piece.anchor, pieceRoot: piece.pieceRoot, settings: piece.settings }).toEqual({
      anchor: binding.clause.anchor,
      pieceRoot: binding.clause.pieceRoot,
      settings: binding.clause.settings,
    });
  });

  it.each([
    { index: 0, clauseSettings: {} },
    { index: 1, clauseSettings: {} },
    { index: 2, clauseSettings: {} },
    { index: 3, clauseSettings: { trackerPatterns: ["^\\(spec-\\d+\\)$"] } },
    { index: 4, clauseSettings: { confinedPackages: ["uuid"] } },
    { index: 5, clauseSettings: {} },
  ])("carry version 1's given clause settings of run clause $index", ({ index, clauseSettings }) => {
    const binding = readBefore().bindings[index];
    assert.isDefined(binding, `version 1 binds run clause ${index}`);
    expect(binding.clause.clauseSettings).toEqual(clauseSettings);
  });

  it("carry version 2's given check settings under its own names", () => {
    expect(readAfterFile().checkSettings).toMatchObject([
      { address: { check: "untracked-escape#directive-pointers" }, values: { trackerPatterns: ["^\\(spec-\\d+\\)$"] } },
      { address: { check: "outside-import-past-a-boundary#import-or-require" }, values: { confinedOutsideDependencies: ["uuid"] } },
      { address: { check: "branch-in-a-test#test-body" }, values: { edition: "2" } },
    ]);
  });

  it("pin the second edition of the test-body clause", () => {
    const [edition] = readBefore().selection.editions;
    assert.isDefined(edition, "version 1 pins an edition");
    expect({ before: edition.edition, latest: readAfterPiece({ index: 5 }).editions.latest }).toEqual({ before: "2", latest: "2" });
  });

  it("leave the same clause not adopted", () => {
    expect(readBefore().selection.notAdopted).toEqual([clauseAddressSchema.parse("CD-15#loops")]);
    expect(readAfterFile().checks[11]).toEqual({
      address: { ruleSet: "hone", check: "loop-keyword#loop-statement" },
      state: { state: "not-adopted" },
    });
  });
});
