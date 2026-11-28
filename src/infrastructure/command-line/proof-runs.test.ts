import { describe, expect, it, vi } from "vitest";

import type { ProofRunSources } from "../../application/ports/upgrade/proof-runs.ts";
import { createRuleContent } from "../../domain/language-layer/rule-content.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { CheckReport } from "../../domain/report/check-report.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { proofRunsOf } from "./proof-runs.ts";

const AFTER: RunReport = {
  judged: "touched-debt",
  excluded: [],
  "not-adopted": [],
  "not-run": [],
  editions: [],
  findings: [],
  answered: [],
  held: [],
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

const WRITTEN = { written: [repoPathOf("hone.eslint.d.mts")] };

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [{ name: "eslint" }],
  symptoms: [],
  clauses: [],
  namedBans: [],
  checks: [],
};

const CONTENT = createRuleContent({ catalogues: [CATALOGUE] });

const POINTERS = {
  symptomPage: "rules/typescript/symptoms.md",
  pruneCommand: "hone prune-debt --repo .",
  projectCommand: "hone project --repo .",
};

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
};

describe("proofRunsOf", () => {
  it("hands back the version 1 report", async () => {
    const runs = proofRunsOf({
      versionOne: vi
        .fn<ProofRunSources["versionOne"]>()
        .mockResolvedValue({ outcome: "ok", value: BEFORE }),
      versionTwo: vi.fn<ProofRunSources["versionTwo"]>(),
      pointers: POINTERS,
    });

    const before = await runs.versionOne();

    expect(before).toEqual({ outcome: "ok", value: BEFORE });
  });

  it("names a version 1 load failure as a failed run", async () => {
    const runs = proofRunsOf({
      versionOne: vi.fn<ProofRunSources["versionOne"]>().mockResolvedValue({
        outcome: "failed",
        error: { kind: "selection-absent", repo: "/repo" },
      }),
      versionTwo: vi.fn<ProofRunSources["versionTwo"]>(),
      pointers: POINTERS,
    });

    const before = await runs.versionOne();

    expect(before).toEqual({
      outcome: "failed",
      error: {
        kind: "run-failed",
        detail:
          "selection-absent /repo holds no disciplines.json; give the folder that holds it, usually the repository root",
      },
    });
  });

  it("hands back the version 2 run's report with no failing lines when it passes, handing the run the files the upgrade wrote", async () => {
    const versionTwo = vi.fn<ProofRunSources["versionTwo"]>().mockResolvedValue({
      outcome: "ok",
      value: { report: AFTER, catalogue: CATALOGUE, content: CONTENT },
    });
    const runs = proofRunsOf({
      versionOne: vi.fn<ProofRunSources["versionOne"]>(),
      versionTwo,
      pointers: POINTERS,
    });

    const checked = await runs.versionTwo(WRITTEN);

    expect({ checked, calls: versionTwo.mock.calls }).toEqual({
      checked: { outcome: "ok", value: { report: AFTER, failing: [] } },
      calls: [[WRITTEN]],
    });
  });

  it("gives the failing sections' lines of a run that fails", async () => {
    const failingReport: RunReport = {
      ...AFTER,
      unmeasured: [
        { kind: "engine-not-run", engine: { name: "eslint" }, projection: "measured-nothing" },
      ],
    };
    const versionTwo = vi.fn<ProofRunSources["versionTwo"]>().mockResolvedValue({
      outcome: "ok",
      value: { report: failingReport, catalogue: CATALOGUE, content: CONTENT },
    });
    const runs = proofRunsOf({
      versionOne: vi.fn<ProofRunSources["versionOne"]>(),
      versionTwo,
      pointers: POINTERS,
    });

    const checked = await runs.versionTwo(WRITTEN);

    expect(checked).toEqual({
      outcome: "ok",
      value: {
        report: failingReport,
        failing: [
          "unmeasured (1)",
          "engine-not-run eslint measured-nothing: the eslint engine measured no file in this run, so the records its checks answer were not judged, neither kept as answering nor removed as stale; check that the eslint configuration lints the files under check",
        ],
      },
    });
  });

  it("names a version 2 load failure as a failed run", async () => {
    const runs = proofRunsOf({
      versionOne: vi.fn<ProofRunSources["versionOne"]>(),
      versionTwo: vi.fn<ProofRunSources["versionTwo"]>().mockResolvedValue({
        outcome: "failed",
        error: { kind: "config-absent", repo: "/repo" },
      }),
      pointers: POINTERS,
    });

    const checked = await runs.versionTwo(WRITTEN);

    expect(checked).toEqual({
      outcome: "failed",
      error: {
        kind: "run-failed",
        detail:
          "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root",
      },
    });
  });
});
