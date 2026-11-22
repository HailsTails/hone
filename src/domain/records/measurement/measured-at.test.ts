import { describe, expect, it } from "vitest";

import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import type { ReachedPlace } from "../answering/record-reach.ts";
import { measurementOf, type RunMeasurement, type RunMeasurements } from "./measured-at.ts";

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

const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const OTHER_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("non-null-assertions"),
};

const FILE_A = repoPathOf("src/a.ts");

const FILE_B = repoPathOf("src/b.ts");

const CHECK: Check = {
  name: "cast-expressions",
  symptom: SYMPTOM,
  clause: CLAUSE,
  engines: [{ name: "eslint" }],
  forms: [],
};

const AT_FILE_A: ReachedPlace = { check: CHECK, place: { at: "file", file: FILE_A } };

const AT_SRC: ReachedPlace = { check: CHECK, place: { at: "module", module: repoPathOf("src") } };

const TRACKED = [FILE_A, FILE_B];

const measurementsOf = (request: {
  readonly runs: readonly RunMeasurement[];
}): RunMeasurements => ({ runs: request.runs, tracked: TRACKED, excluded: [] });

const eslintRun = (request: Pick<RunMeasurement, "selected" | "measured">): RunMeasurement => ({
  mechanism: ESLINT,
  ...request,
});

describe("measurementOf", () => {
  it("says measured when a run of an engine of the check selected its clause and reported it measured at the file", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_A }] })],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("measured");
  });

  it("says measured for a module place when the run measured a file under the module", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_B }] })],
        }),
        reached: AT_SRC,
      }),
    ).toBe("measured");
  });

  it("says not-measured when the run selected the clause and measured it at other files only", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [eslintRun({ selected: [CLAUSE], measured: [{ clause: CLAUSE, file: FILE_B }] })],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("not-measured");
  });

  it("says not-measured when the run measured the file for another clause only", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [
            eslintRun({ selected: [CLAUSE], measured: [{ clause: OTHER_CLAUSE, file: FILE_A }] }),
          ],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("not-measured");
  });

  it("says not-run when no run of an engine of the check selected its clause", () => {
    expect(
      measurementOf({
        measurements: measurementsOf({
          runs: [
            eslintRun({ selected: [OTHER_CLAUSE], measured: [] }),
            { mechanism: WALKER, selected: [CLAUSE], measured: [] },
          ],
        }),
        reached: AT_FILE_A,
      }),
    ).toBe("not-run");
  });

  it("says gone when the run selected the clause and the place is no longer in the tree", () => {
    const measurements: RunMeasurements = {
      runs: [eslintRun({ selected: [CLAUSE], measured: [] })],
      tracked: [FILE_B],
      excluded: [],
    };
    expect(measurementOf({ measurements, reached: AT_FILE_A })).toBe("gone");
  });

  it("says excluded, not gone, when the settings exclude the file, which is also out of the tracked files", () => {
    const measurements: RunMeasurements = {
      runs: [eslintRun({ selected: [CLAUSE], measured: [] })],
      tracked: [FILE_B],
      excluded: [FILE_A],
    };
    expect(measurementOf({ measurements, reached: AT_FILE_A })).toBe("excluded");
  });

  it("says excluded for a module place inside an excluded folder", () => {
    const measurements: RunMeasurements = {
      runs: [eslintRun({ selected: [CLAUSE], measured: [] })],
      tracked: [],
      excluded: [repoPathOf("src")],
    };
    expect(
      measurementOf({
        measurements,
        reached: { check: CHECK, place: { at: "module", module: repoPathOf("src/adapters") } },
      }),
    ).toBe("excluded");
  });

  it("says not-run when there are no runs", () => {
    expect(measurementOf({ measurements: measurementsOf({ runs: [] }), reached: AT_FILE_A })).toBe(
      "not-run",
    );
  });
});
