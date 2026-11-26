import { describe, expect, it } from "vitest";

import type { Engine } from "../../domain/language-layer/symptom-catalogue.ts";
import type { RunProjectionProblem, RunUnmeasured } from "../../domain/report/run-report.ts";
import type { BaseRevisionAvailability } from "../../domain/repository/base-revision-availability.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import type { UnreadConventionKey } from "../../domain/settings/settings-note.ts";
import {
  assessmentLine,
  projectionMissingLine,
  projectionProblemLine,
  settingsNoteLine,
  settingsNoteText,
  unmeasuredLine,
} from "./run-state-lines.ts";

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const PROJECT_COMMAND =
  "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop";

const GIT_FAILED: BaseRevisionAvailability = {
  state: "git-failed",
  revision: "origin/main",
  gitMessage: "fatal: bad revision",
};

const SLICE = repoPathOf("packages/web/hone.eslint.mjs");

const LEGACY = repoPathOf("packages/legacy");

const NOT_INCLUDED_TEXT =
  "engine-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of hone.eslint.mjs, or of a package's own hone.eslint.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes";

const SLICES_NOTE = "; the eslint lines under projection-problems name the package slices involved";

const NESTED_NOTE = `; packages/legacy hold their own hone.config.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its hone.config.json and keep its records here, then run ${PROJECT_COMMAND}, which writes its slice`;

const NOT_INCLUDED: RunUnmeasured = {
  kind: "engine-not-run",
  engine: ESLINT_ENGINE,
  projection: "not-included",
  file: repoPathOf("hone.eslint.mjs"),
  nestedConfigurations: [],
};

const NESTED_NOT_INCLUDED: RunUnmeasured = {
  kind: "engine-not-run",
  engine: ESLINT_ENGINE,
  projection: "not-included",
  file: repoPathOf("hone.eslint.mjs"),
  nestedConfigurations: [LEGACY],
};

const ESLINT_SLICE_PROBLEM: RunProjectionProblem = {
  scope: "slice",
  engine: ESLINT_ENGINE,
  state: "missing",
  file: SLICE,
};

const WALKER_SLICE_PROBLEM: RunProjectionProblem = {
  scope: "slice",
  engine: WALKER,
  state: "missing",
  file: SLICE,
};

describe("unmeasuredLine", () => {
  it.each<{ readonly name: string; readonly unmeasured: RunUnmeasured; readonly line: string }>([
    {
      name: "forfeiture with no base revision given",
      unmeasured: { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
      line: 'forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere',
    },
    {
      name: "forfeiture when git could not read the base",
      unmeasured: { kind: "forfeiture-unmeasured", base: GIT_FAILED },
      line: 'forfeiture-unmeasured base-git-failed "origin/main": git could not list the files changed since that revision and said "fatal: bad revision"; Hone needs that revision and the history back to where this branch left it, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere',
    },
    {
      name: "carried records with no base revision given",
      unmeasured: { kind: "import-unmeasured", base: { state: "not-given" } },
      line: 'import-unmeasured no-base-revision: no --base-revision was given, so carried records cannot be checked against it; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere',
    },
    {
      name: "carried records when git could not read the base",
      unmeasured: { kind: "import-unmeasured", base: GIT_FAILED },
      line: 'import-unmeasured base-git-failed "origin/main": git could not read hone-records at that revision and said "fatal: bad revision"; Hone needs hone-records as it was at that revision',
    },
    {
      name: "an engine whose projection is not written",
      unmeasured: {
        kind: "engine-not-run",
        engine: ESLINT_ENGINE,
        projection: "missing",
        file: repoPathOf("hone.eslint.mjs"),
      },
      line: `engine-not-run eslint missing: hone.eslint.mjs is not written; run ${PROJECT_COMMAND} and commit every file it writes`,
    },
    {
      name: "an engine whose projection is not in effect",
      unmeasured: NOT_INCLUDED,
      line: NOT_INCLUDED_TEXT,
    },
    {
      name: "an engine whose projection is not in effect under nested configurations",
      unmeasured: NESTED_NOT_INCLUDED,
      line: `${NOT_INCLUDED_TEXT}${NESTED_NOTE}`,
    },
  ])("prints $name", ({ unmeasured, line }) => {
    expect(
      unmeasuredLine({
        projectCommand: PROJECT_COMMAND,
        unmeasured,
        problems: [],
      }),
    ).toBe(line);
  });

  it("points at the engine's slice problems when projection-problems names any", () => {
    expect(
      unmeasuredLine({
        projectCommand: PROJECT_COMMAND,
        unmeasured: NESTED_NOT_INCLUDED,
        problems: [ESLINT_SLICE_PROBLEM],
      }),
    ).toBe(`${NOT_INCLUDED_TEXT}${SLICES_NOTE}${NESTED_NOTE}`);
  });

  it("does not point at another engine's slice problems", () => {
    expect(
      unmeasuredLine({
        projectCommand: PROJECT_COMMAND,
        unmeasured: NOT_INCLUDED,
        problems: [WALKER_SLICE_PROBLEM],
      }),
    ).toBe(NOT_INCLUDED_TEXT);
  });

  it("names the typed projection to spread when the repository projects the ts kind", () => {
    const line = unmeasuredLine({
      projectCommand: PROJECT_COMMAND,
      unmeasured: { ...NOT_INCLUDED, file: repoPathOf("hone.eslint.ts") },
      problems: [],
    });

    expect(line).toBe(
      "engine-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of hone.eslint.ts, or of a package's own hone.eslint.ts in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes",
    );
  });
});

describe("projectionProblemLine", () => {
  it.each<{ readonly name: string; readonly problem: RunProjectionProblem; readonly line: string }>(
    [
      {
        name: "an out-of-date projection",
        problem: {
          scope: "projection",
          engine: ESLINT_ENGINE,
          state: "out-of-date",
          file: repoPathOf("hone.eslint.mjs"),
        },
        line: `eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run ${PROJECT_COMMAND} and commit every file it writes`,
      },
      {
        name: "an out-of-date slice",
        problem: { scope: "slice", engine: ESLINT_ENGINE, state: "out-of-date", file: SLICE },
        line: `eslint out-of-date packages/web/hone.eslint.mjs: that slice differs from what hone project writes now; run ${PROJECT_COMMAND} and commit every file it writes`,
      },
      {
        name: "an obsolete projection file",
        problem: {
          scope: "file",
          engine: ESLINT_ENGINE,
          state: "left-over",
          file: repoPathOf("hone.eslint.ts"),
        },
        line: `eslint left-over hone.eslint.ts: hone project no longer writes this file for the selected projection kind; run ${PROJECT_COMMAND} to remove it`,
      },
      {
        name: "a missing slice",
        problem: ESLINT_SLICE_PROBLEM,
        line: `eslint missing packages/web/hone.eslint.mjs: that slice is not written; run ${PROJECT_COMMAND} and commit every file it writes`,
      },
      {
        name: "a missing declaration of a slice's type",
        problem: {
          scope: "slice",
          engine: ESLINT_ENGINE,
          state: "missing",
          file: repoPathOf("packages/web/hone.eslint.d.mts"),
        },
        line: `eslint missing packages/web/hone.eslint.d.mts: that slice is not written; run ${PROJECT_COMMAND} and commit every file it writes`,
      },
      {
        name: "a slice with no configuration to load it",
        problem: { scope: "slice", engine: ESLINT_ENGINE, state: "unconfigured", file: SLICE },
        line: "eslint unconfigured packages/web/hone.eslint.mjs: packages/web has no eslint configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check",
      },
    ],
  )("prints $name", ({ problem, line }) => {
    expect(projectionProblemLine({ projectCommand: PROJECT_COMMAND, problem })).toBe(line);
  });

  it("names the typed projection when the repository projects the ts kind and it is out of date", () => {
    const line = projectionProblemLine({
      projectCommand: PROJECT_COMMAND,
      problem: {
        scope: "projection",
        engine: ESLINT_ENGINE,
        state: "out-of-date",
        file: repoPathOf("hone.eslint.ts"),
      },
    });

    expect(line).toBe(
      `eslint out-of-date: hone.eslint.ts differs from what hone project writes now; run ${PROJECT_COMMAND} and commit every file it writes`,
    );
  });
});

describe("projectionMissingLine", () => {
  it("names the engine whose projection is not written and the project command", () => {
    expect(
      projectionMissingLine({
        unmeasured: {
          kind: "engine-not-run",
          engine: ESLINT_ENGINE,
          projection: "missing",
          file: repoPathOf("hone.eslint.mjs"),
        },
        projectCommand: "node /tool/hone.js project --repo /repo",
      }),
    ).toBe(
      "engine-not-run eslint missing: hone.eslint.mjs is not written; run node /tool/hone.js project --repo /repo and commit every file it writes",
    );
  });

  it("names the typed projection when the repository projects the ts kind", () => {
    const line = projectionMissingLine({
      unmeasured: {
        kind: "engine-not-run",
        engine: ESLINT_ENGINE,
        projection: "missing",
        file: repoPathOf("hone.eslint.ts"),
      },
      projectCommand: "node /tool/hone.js project --repo /repo",
    });

    expect(line).toBe(
      "engine-not-run eslint missing: hone.eslint.ts is not written; run node /tool/hone.js project --repo /repo and commit every file it writes",
    );
  });
});

describe("assessmentLine", () => {
  it("names nested folders where the parent projection does not apply", () => {
    expect(
      assessmentLine({
        partial: { concern: "nested-projection", engine: ESLINT_ENGINE, folders: [LEGACY] },
      }),
    ).toContain("packages/legacy");
  });

  it.each([
    {
      debts: 1,
      line: "forfeiture elsewhere: 1 debt record not checked for forfeiture in this run",
    },
    {
      debts: 3,
      line: "forfeiture elsewhere: 3 debt records not checked for forfeiture in this run",
    },
  ])("counts $debts debt records left to another run", ({ debts, line }) => {
    expect(
      assessmentLine({ partial: { concern: "forfeiture", assessedBy: "elsewhere", debts } }),
    ).toBe(line);
  });

  it.each([
    {
      carried: 1,
      line: "carried standing elsewhere: 1 carried record not checked against the base in this run",
    },
    {
      carried: 4,
      line: "carried standing elsewhere: 4 carried records not checked against the base in this run",
    },
  ])("counts $carried carried records left to a run that has a base", ({ carried, line }) => {
    expect(
      assessmentLine({
        partial: { concern: "carried-standing", assessedBy: "elsewhere", carried },
      }),
    ).toBe(line);
  });
});

describe("settingsNoteLine", () => {
  it.each<{ readonly key: UnreadConventionKey; readonly line: string }>([
    { key: "generated", line: "generated is declared; no check reads it yet" },
    { key: "layers", line: "layers is declared; no check reads it yet" },
  ])("says $key is declared and read by no check yet", ({ key, line }) => {
    expect(settingsNoteLine({ note: { kind: "declared-not-read", key } })).toBe(line);
  });
});

describe("settingsNoteText", () => {
  it.each<{ readonly key: "generated" | "layers"; readonly text: string }>([
    { key: "generated", text: "generated is declared; no check reads it yet" },
    { key: "layers", text: "layers is declared; no check reads it yet" },
  ])("writes $text", ({ key, text }) => {
    expect(settingsNoteText({ note: { kind: "declared-not-read", key } })).toBe(text);
  });
});
