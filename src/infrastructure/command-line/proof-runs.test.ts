import { describe, expect, it, vi } from "vitest";

import type { ProofRunSources } from "../../application/ports/upgrade/proof-runs.ts";
import type { CheckReport } from "../../domain/report/check-report.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import { proofRunsOf } from "./proof-runs.ts";

const BEFORE: CheckReport = {
  excluded: [],
  notAdopted: [],
  notRun: [],
  editions: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
  assessment: [],
  readFirst: [],
};

const AFTER: RunReport = {
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  available: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  misnamed: [],
  paid: [],
  refused: [],
  unmeasured: [],
  "projection-problems": [],
  assessment: [],
  "settings-notes": [],
  "record-notes": [],
  carried: [],
  symptoms: [],
};

const sourcesOver = (overrides: Partial<ProofRunSources>): ProofRunSources => ({
  versionOne: vi
    .fn<ProofRunSources["versionOne"]>()
    .mockResolvedValue({ outcome: "ok", value: BEFORE }),
  versionTwo: vi
    .fn<ProofRunSources["versionTwo"]>()
    .mockResolvedValue({ outcome: "ok", value: { report: AFTER } }),
  ...overrides,
});

describe("proofRunsOf", () => {
  it("hands back the version 1 report and the version 2 run's report", async () => {
    const runs = proofRunsOf(sourcesOver({}));
    await expect(runs.versionOne()).resolves.toEqual({ outcome: "ok", value: BEFORE });
    await expect(runs.versionTwo()).resolves.toEqual({ outcome: "ok", value: AFTER });
  });

  it("names a version 1 load failure as a failed run", async () => {
    const runs = proofRunsOf(
      sourcesOver({
        versionOne: vi.fn<ProofRunSources["versionOne"]>().mockResolvedValue({
          outcome: "failed",
          error: { kind: "selection-absent", repo: "/repo" },
        }),
      }),
    );
    await expect(runs.versionOne()).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "run-failed",
        detail:
          "selection-absent /repo holds no disciplines.json; give the folder that holds it, usually the repository root",
      },
    });
  });

  it("names a version 2 load failure as a failed run", async () => {
    const runs = proofRunsOf(
      sourcesOver({
        versionTwo: vi.fn<ProofRunSources["versionTwo"]>().mockResolvedValue({
          outcome: "failed",
          error: { kind: "config-absent", repo: "/repo" },
        }),
      }),
    );
    await expect(runs.versionTwo()).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "run-failed",
        detail:
          "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root",
      },
    });
  });
});
