import { describe, expect, it } from "vitest";

import type {
  Engine,
  RecordKind,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { RunMeasurement } from "../../../domain/records/measurement/measured-at.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type { NamedEngineRun } from "../../ports/engine/engine-run.ts";
import {
  engineMeasurementOf,
  engineProblemsOf,
  engineUnmeasuredOf,
  refreshableProjectionOf,
} from "./engine-states.ts";

const CAST = "claimed-type#cast-expressions";

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const REPORT_CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

const runWith = (request: {
  readonly mechanism: NamedEngineRun["mechanism"];
  readonly projection: NamedEngineRun["projection"];
}): NamedEngineRun => ({
  mechanism: request.mechanism,
  hits: [],
  nativeExceptions: [],
  coverableKinds: [],
  projection: request.projection,
  slices: [],
  measured: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
});

const TRACKED = [repoPathOf("src/a.ts")];

describe("engineUnmeasuredOf", () => {
  it("names the engine a run left out of effect because its projection is not written", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "missing" })],
        tracked: TRACKED,
        selected: [],
      }),
    ).toEqual([{ kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" }]);
  });

  it("names the engine a run left out of effect because the team's configuration does not include its projection", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "not-included" })],
        tracked: TRACKED,
        selected: [],
      }),
    ).toEqual([
      {
        kind: "engine-not-run",
        engine: ESLINT_ENGINE,
        projection: "not-included",
        nestedConfigurations: [],
      },
    ]);
  });

  it.each(["not-included", "current", "out-of-date"] as const)(
    "names a nested folder beyond all measured coverage when projection is %s",
    (projection) => {
      const folder = repoPathOf("pkg");
      expect(
        engineUnmeasuredOf({
          catalogue: REPORT_CATALOGUE,
          runs: [
            {
              ...runWith({ mechanism: ESLINT, projection }),
              nestedConfigurations: [folder],
            },
          ],
          tracked: TRACKED,
          selected: [],
        }),
      ).toEqual([
        {
          kind: "engine-not-run",
          engine: ESLINT_ENGINE,
          projection: "not-included",
          nestedConfigurations: [folder],
        },
      ]);
    },
  );

  it("names the mechanism when the catalogue gives it no engine", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: { ...REPORT_CATALOGUE, engines: [WALKER] },
        runs: [runWith({ mechanism: ESLINT, projection: "missing" })],
        tracked: TRACKED,
        selected: [],
      }),
    ).toEqual([{ kind: "engine-not-run", engine: { name: "eslint" }, projection: "missing" }]);
  });

  it("names nothing for a run whose projection is current, out of date or not needed", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [
          runWith({ mechanism: ESLINT, projection: "current" }),
          runWith({ mechanism: ESLINT, projection: "out-of-date" }),
          runWith({ mechanism: AUDIT, projection: "none" }),
        ],
        tracked: TRACKED,
        selected: [],
      }),
    ).toEqual([]);
  });
});

describe("engineUnmeasuredOf, an engine that measured nothing", () => {
  const SELECTED: readonly Pick<CheckBinding, "address" | "engine">[] = [
    { address: CAST, engine: ESLINT },
  ];

  const MEASURED_NOTHING = {
    kind: "engine-not-run",
    engine: ESLINT_ENGINE,
    projection: "measured-nothing",
  };

  it("names an engine with selected checks that measured no file under a current or out-of-date projection", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [
          runWith({ mechanism: ESLINT, projection: "current" }),
          runWith({ mechanism: ESLINT, projection: "out-of-date" }),
        ],
        tracked: TRACKED,
        selected: SELECTED,
      }),
    ).toEqual([MEASURED_NOTHING, MEASURED_NOTHING]);
  });

  it("names nothing for an engine with selected checks when the tree holds no TypeScript file to measure", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "current" })],
        tracked: [repoPathOf("README.md")],
        selected: SELECTED,
      }),
    ).toEqual([]);
  });

  it("names the missing projection and not the engine measuring nothing when both hold", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "missing" })],
        tracked: TRACKED,
        selected: SELECTED,
      }),
    ).toEqual([{ kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "missing" }]);
  });

  it("names nothing for an engine that measured a file, one that needs no projection, or one with no selected check", () => {
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [
          {
            ...runWith({ mechanism: ESLINT, projection: "current" }),
            measured: [{ check: CAST, file: repoPathOf("src/a.ts") }],
          },
          runWith({ mechanism: AUDIT, projection: "none" }),
        ],
        tracked: TRACKED,
        selected: [...SELECTED, { address: CAST, engine: AUDIT }],
      }),
    ).toEqual([]);
    expect(
      engineUnmeasuredOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "current" })],
        tracked: TRACKED,
        selected: [],
      }),
    ).toEqual([]);
  });
});

const FILE_A = repoPathOf("src/a.ts");

const FILE_B = repoPathOf("src/b.ts");

const eslintRun = (request: Pick<RunMeasurement, "selected" | "measured">): RunMeasurement => ({
  mechanism: ESLINT,
  ...request,
});

const IN_REACH = [FILE_A, FILE_B];

describe("engineMeasurementOf", () => {
  it("says measured-nothing for a run with selected checks that reported no measured pair", () => {
    expect(
      engineMeasurementOf({
        run: eslintRun({ selected: [CAST], measured: [] }),
        inReach: IN_REACH,
      }),
    ).toBe("measured-nothing");
  });

  it("says measured-something for a run that reported a measured pair", () => {
    expect(
      engineMeasurementOf({
        run: eslintRun({ selected: [CAST], measured: [{ check: CAST, file: FILE_A }] }),
        inReach: IN_REACH,
      }),
    ).toBe("measured-something");
  });

  it("says nothing-to-measure for a run with selected checks when no file is in its reach", () => {
    expect(
      engineMeasurementOf({ run: eslintRun({ selected: [CAST], measured: [] }), inReach: [] }),
    ).toBe("nothing-to-measure");
  });

  it("says nothing-selected for a run with no selected clause", () => {
    expect(
      engineMeasurementOf({ run: eslintRun({ selected: [], measured: [] }), inReach: IN_REACH }),
    ).toBe("nothing-selected");
  });
});

describe("engineProblemsOf", () => {
  it("names the engine whose projection differs from what project writes now", () => {
    expect(
      engineProblemsOf({
        catalogue: REPORT_CATALOGUE,
        runs: [runWith({ mechanism: ESLINT, projection: "out-of-date" })],
      }),
    ).toEqual([{ scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" }]);
  });

  it("names each package file a run found missing, out of date or not loaded, beside a current root projection", () => {
    const run: NamedEngineRun = {
      ...runWith({ mechanism: ESLINT, projection: "current" }),
      slices: [
        { slice: repoPathOf("packages/a/hone.eslint.mjs"), state: "missing" },
        { slice: repoPathOf("packages/b/hone.eslint.mjs"), state: "out-of-date" },
        { slice: repoPathOf("packages/c/hone.eslint.mjs"), state: "unconfigured" },
      ],
    };
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [run] })).toEqual([
      {
        scope: "slice",
        engine: ESLINT_ENGINE,
        state: "missing",
        slice: "packages/a/hone.eslint.mjs",
      },
      {
        scope: "slice",
        engine: ESLINT_ENGINE,
        state: "out-of-date",
        slice: "packages/b/hone.eslint.mjs",
      },
      {
        scope: "slice",
        engine: ESLINT_ENGINE,
        state: "unconfigured",
        slice: "packages/c/hone.eslint.mjs",
      },
    ]);
  });

  it("names the root projection first, then the package files, when both differ", () => {
    const run: NamedEngineRun = {
      ...runWith({ mechanism: ESLINT, projection: "out-of-date" }),
      slices: [{ slice: repoPathOf("packages/a/hone.eslint.mjs"), state: "out-of-date" }],
    };
    expect(engineProblemsOf({ catalogue: REPORT_CATALOGUE, runs: [run] })).toEqual([
      { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" },
      {
        scope: "slice",
        engine: ESLINT_ENGINE,
        state: "out-of-date",
        slice: "packages/a/hone.eslint.mjs",
      },
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

describe("refreshableProjectionOf", () => {
  const SLICE = repoPathOf("packages/a/hone.eslint.mjs");

  const MISSING_ROOT = {
    kind: "engine-not-run",
    engine: ESLINT_ENGINE,
    projection: "missing",
  } as const;

  it("is nothing when there are no problems and nothing unmeasured", () => {
    expect(refreshableProjectionOf({ problems: [], unmeasured: [] })).toBeUndefined();
  });

  it("is nothing for a slice no configuration loads, which project does not repair", () => {
    expect(
      refreshableProjectionOf({
        problems: [{ scope: "slice", engine: ESLINT_ENGINE, state: "unconfigured", slice: SLICE }],
        unmeasured: [],
      }),
    ).toBeUndefined();
  });

  it("is nothing for an engine that measured nothing or is not included, which project does not repair", () => {
    expect(
      refreshableProjectionOf({
        problems: [],
        unmeasured: [
          { kind: "engine-not-run", engine: ESLINT_ENGINE, projection: "measured-nothing" },
          {
            kind: "engine-not-run",
            engine: ESLINT_ENGINE,
            projection: "not-included",
            nestedConfigurations: [],
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("is the out-of-date root projection", () => {
    const problem = { scope: "projection", engine: ESLINT_ENGINE, state: "out-of-date" } as const;

    expect(refreshableProjectionOf({ problems: [problem], unmeasured: [] })).toBe(problem);
  });

  it("is the root projection that is not written", () => {
    expect(refreshableProjectionOf({ problems: [], unmeasured: [MISSING_ROOT] })).toBe(
      MISSING_ROOT,
    );
  });

  it.each(["missing", "out-of-date"] as const)("is a slice that is %s", (state) => {
    const problem = { scope: "slice", engine: ESLINT_ENGINE, state, slice: SLICE } as const;

    expect(
      refreshableProjectionOf({
        problems: [
          { scope: "slice", engine: ESLINT_ENGINE, state: "unconfigured", slice: SLICE },
          problem,
        ],
        unmeasured: [],
      }),
    ).toBe(problem);
  });
});
