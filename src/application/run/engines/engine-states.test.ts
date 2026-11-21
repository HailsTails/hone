import { describe, expect, it } from "vitest";
import { AUDIT, ESLINT, ESLINT_ENGINE, REPORT_CATALOGUE } from "../../../../tests/report-catalogue.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { RunMeasurement } from "../../../domain/records/measurement/measured-at.ts";
import type { EngineRun } from "../../../infrastructure/engines/protocol/engine-run/engine-run.ts";
import { engineMeasurementOf, engineProblemsOf, engineUnmeasuredOf } from "./engine-states.ts";

const runWith = (request: { readonly mechanism: EngineRun["mechanism"]; readonly projection: EngineRun["projection"] }): EngineRun => ({
  mechanism: request.mechanism,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: request.projection,
  slices: [],
  unprojectedFolders: [],
  measured: [],
  misnamedRuleIds: [],
});

const TRACKED = [repoPathSchema.parse("src/a.ts")];

describe("engineUnmeasuredOf", () => {
  it("names the engine a run left out of effect because its projection is not written", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "missing" })], tracked: TRACKED, selected: [] })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
    ]);
  });

  it("names the engine a run left out of effect because the team's configuration does not include its projection", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "not-included" })], tracked: TRACKED, selected: [] })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "not-included", nestedConfigurations: [] },
    ]);
  });

  it("names the mechanism when the catalogue gives it no engine", () => {
    const stranger = mechanismIdSchema.parse("stranger");
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: stranger, projection: "missing" })], tracked: TRACKED, selected: [] })).toEqual([
      { kind: "engine-not-run", engine: { name: "stranger", mechanism: stranger }, projection: "missing" },
    ]);
  });

  it("names nothing for a run whose projection is current, out of date or not needed", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "current" }), runWith({ mechanism: ESLINT, projection: "out-of-date" }), runWith({ mechanism: AUDIT, projection: "none" })],
        tracked: TRACKED, selected: [],
      }),
    ).toEqual([]);
  });
});

describe("engineUnmeasuredOf, an engine that measured nothing", () => {
  const CLAUSE = clauseAddressSchema.parse("CD-2#cast-expressions");

  const SELECTED = [{ address: CLAUSE, mechanism: ESLINT, exceptions: "allowed" as const }];

  const MEASURED_NOTHING = { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" };

  it("names an engine with selected checks that measured no file under a current or out-of-date projection", () => {
    expect(
      engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "current" }), runWith({ mechanism: ESLINT, projection: "out-of-date" })], tracked: TRACKED, selected: SELECTED }),
    ).toEqual([MEASURED_NOTHING, MEASURED_NOTHING]);
  });

  it("names nothing for an engine with selected checks when the tree holds no TypeScript file to measure", () => {
    expect(
      engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "current" })], tracked: [repoPathSchema.parse("README.md")], selected: SELECTED }),
    ).toEqual([]);
  });

  it("names the missing projection and not the engine measuring nothing when both hold", () => {
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "missing" })], tracked: TRACKED, selected: SELECTED })).toEqual([
      { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" },
    ]);
  });

  it("names nothing for an engine that measured a file, one that needs no projection, or one with no selected check", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [{ ...runWith({ mechanism: ESLINT, projection: "current" }), measured: [{ clause: CLAUSE, file: repoPathSchema.parse("src/a.ts") }] }, runWith({ mechanism: AUDIT, projection: "none" })],
        tracked: TRACKED, selected: [...SELECTED, { address: CLAUSE, mechanism: AUDIT, exceptions: "allowed" as const }],
      }),
    ).toEqual([]);
    expect(engineUnmeasuredOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "current" })], tracked: TRACKED, selected: [] })).toEqual([]);
  });
});

const FILE_A = repoPathSchema.parse("src/a.ts");

const FILE_B = repoPathSchema.parse("src/b.ts");

const eslintRun = (request: Pick<RunMeasurement, "selected" | "measured">): RunMeasurement => ({ mechanism: ESLINT, ...request });

const CLAUSE = clauseAddressSchema.parse("CD-2#cast-expressions");

const IN_REACH = [FILE_A, FILE_B];

describe("engineMeasurementOf", () => {
  it("says measured-nothing for a run with selected clauses that reported no measured pair", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [CLAUSE], measured: [] }), inReach: IN_REACH })).toBe("measured-nothing");
  });

  it("says measured-something for a run that reported a measured pair", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_A }] }), inReach: IN_REACH })).toBe("measured-something");
  });

  it("says nothing-to-measure for a run with selected clauses when no file is in its reach", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [CLAUSE], measured: [] }), inReach: [] })).toBe("nothing-to-measure");
  });

  it("says nothing-selected for a run with no selected clause", () => {
    expect(engineMeasurementOf({ run: eslintRun({ selected: [], measured: [] }), inReach: IN_REACH })).toBe("nothing-selected");
  });
});

describe("engineProblemsOf", () => {
  it("names the engine whose projection differs from what project writes now", () => {
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [runWith({ mechanism: ESLINT, projection: "out-of-date" })] })).toEqual([
      { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
    ]);
  });

  it("names each package file a run found missing, out of date or not loaded, beside a current root projection", () => {
    const run: EngineRun = {
      ...runWith({ mechanism: ESLINT, projection: "current" }),
      slices: [
        { slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "missing" },
        { slice: repoPathSchema.parse("packages/b/hone.eslint.mjs"), state: "out-of-date" },
        { slice: repoPathSchema.parse("packages/c/hone.eslint.mjs"), state: "unconfigured" },
      ],
    };
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [run] })).toEqual([
      { scope: "slice", engine: ESLINT_ENGINE, state: "missing", slice: "packages/a/hone.eslint.mjs" },
      { scope: "slice", engine: ESLINT_ENGINE, state: "out-of-date", slice: "packages/b/hone.eslint.mjs" },
      { scope: "slice", engine: ESLINT_ENGINE, state: "unconfigured", slice: "packages/c/hone.eslint.mjs" },
    ]);
  });

  it("names the root projection first, then the package files, when both differ", () => {
    const run: EngineRun = {
      ...runWith({ mechanism: ESLINT, projection: "out-of-date" }),
      slices: [{ slice: repoPathSchema.parse("packages/a/hone.eslint.mjs"), state: "out-of-date" }],
    };
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [run] })).toEqual([
      { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
      { scope: "slice", engine: ESLINT_ENGINE, state: "out-of-date", slice: "packages/a/hone.eslint.mjs" },
    ]);
  });

  it("names nothing for a projection that is current, missing, not included or not needed", () => {
    expect(
      engineProblemsOf({
        catalogue: REPORT_CATALOGUE,
        runs: [
          runWith({ mechanism: ESLINT, projection: "current" }),
          runWith({ mechanism: ESLINT, projection: "missing" }),
          runWith({ mechanism: ESLINT, projection: "not-included" }),
          runWith({ mechanism: AUDIT, projection: "none" }),
        ],
      }),
    ).toEqual([]);
  });
});
