import { describe, expect, it } from "vitest";

import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { ReachedPlace } from "../answering/record-reach.ts";
import {
  type MeasurementIndex,
  measurementIndexOf,
  measurementOf,
  type RunMeasurement,
  type RunMeasurements,
} from "./measured-at.ts";

const WALKER = "walker" as const;

const ESLINT = "eslint" as const;

const SYMPTOM: Symptom = {
  name: "claimed-type",
  title: "Claimed type",
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CAST = "claimed-type#cast-expressions";

const OTHER_CHECK = "claimed-type#non-null-assertions";

const FILE_A = repoPathOf("src/a.ts");

const FILE_B = repoPathOf("src/b.ts");

const CHECK: Check = {
  name: "cast-expressions",
  symptom: SYMPTOM,
  engines: [{ name: "eslint" }],
  forms: [],
};

const AT_FILE_A: ReachedPlace = { check: CHECK, place: { at: "file", file: FILE_A } };

const AT_SRC: ReachedPlace = { check: CHECK, place: { at: "module", module: repoPathOf("src") } };

const TRACKED = [FILE_A, FILE_B];

const measurementsOf = (request: { readonly runs: readonly RunMeasurement[] }): MeasurementIndex =>
  measurementIndexOf({ measurements: { runs: request.runs, tracked: TRACKED, excluded: [] } });

const eslintRun = (request: Pick<RunMeasurement, "selected" | "measured">): RunMeasurement => ({
  mechanism: ESLINT,
  ...request,
});

describe("measurementOf", () => {
  it("says measured when a run of an engine selected the check and reported it measured at the file", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CAST], measured: [{ check: CAST, file: FILE_A }] })],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("measured");
  });

  it("says measured for a module place when the run measured a file under the module", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CAST], measured: [{ check: CAST, file: FILE_B }] })],
        }),
        reached: AT_SRC,
      }),
    ).toBe("measured");
  });

  it("says not-measured when the run selected the check and measured it at other files only", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CAST], measured: [{ check: CAST, file: FILE_B }] })],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("not-measured");
  });

  it("says not-measured when the run measured the file for another check only", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CAST], measured: [{ check: OTHER_CHECK, file: FILE_A }] })],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("not-measured");
  });

  it("says not-run when no run of an engine selected the check", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [
            eslintRun({ selected: [OTHER_CHECK], measured: [] }),
            { mechanism: WALKER, selected: [CAST], measured: [] },
          ],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("not-run");
  });

  it("says gone when the run selected the check and the place is no longer in the tree", () => {
    const measurements: RunMeasurements = {
      runs: [eslintRun({ selected: [CAST], measured: [] })],
      tracked: [FILE_B],
      excluded: [],
    };
    expect(
      measurementOf({ measurements: measurementIndexOf({ measurements }), reached: AT_FILE_A }),
    ).toBe("gone");
  });

  it("says excluded, not gone, when the settings exclude the file, which is also out of the tracked files", () => {
    const measurements: RunMeasurements = {
      runs: [eslintRun({ selected: [CAST], measured: [] })],
      tracked: [FILE_B],
      excluded: [FILE_A],
    };
    expect(
      measurementOf({ measurements: measurementIndexOf({ measurements }), reached: AT_FILE_A }),
    ).toBe("excluded");
  });

  it("says excluded for a module place inside an excluded folder", () => {
    const measurements: RunMeasurements = {
      runs: [eslintRun({ selected: [CAST], measured: [] })],
      tracked: [],
      excluded: [repoPathOf("src")],
    };
    expect(
      measurementOf({
        measurements: measurementIndexOf({ measurements }),
        reached: { check: CHECK, place: { at: "module", module: repoPathOf("src/adapters") } },
      }),
    ).toBe("excluded");
  });

  it("says measured for a module place when the run measured a file folders below it", () => {
    const deep = repoPathOf("src/adapters/files/read.ts");
    expect(
      measurementOf({
        measurements: measurementIndexOf({
          measurements: {
            runs: [eslintRun({ selected: [CAST], measured: [{ check: CAST, file: deep }] })],
            tracked: [deep],
            excluded: [],
          },
        }),
        reached: AT_SRC,
      }),
    ).toBe("measured");
  });

  it("says gone for a file place when only files under a folder of its name are tracked", () => {
    const beneath = repoPathOf("src/a.ts/inner.ts");
    expect(
      measurementOf({
        measurements: measurementIndexOf({
          measurements: {
            runs: [eslintRun({ selected: [CAST], measured: [{ check: CAST, file: beneath }] })],
            tracked: [beneath],
            excluded: [],
          },
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("gone");
  });

  it("says not-run when there are no runs", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [] }), reached: AT_FILE_A })).toBe(
      "not-run",
    );
  });
});
