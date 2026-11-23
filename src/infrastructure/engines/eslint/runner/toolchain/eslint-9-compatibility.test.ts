import { assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { EngineId } from "../../../../../domain/rule-set/identifier-types.ts";
import type { DisciplineFile, SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { casesByEdition } from "../../../../../domain/runner/edition-runs.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { defaultClauseSettings } from "../../../../../domain/settings/clause-settings/default-clause-settings.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { readInstalledNames } from "../../../../content-files/rule-sets/installed-pieces.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { readHeldDiscipline } from "../../../../upgrade/version-one-rule-sets/held-discipline.ts";
import { readLocatedPieceFile } from "../../../../upgrade/version-one-rule-sets/located-piece-file.ts";
import { checkConformance } from "../../../protocol/conformance.ts";
import type { EmbeddedRunner } from "../../../protocol/embedded/embedded-runner-module-schema.ts";
import { runnerModuleSchema } from "../../../protocol/runner-module/runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../embedded-runner/create-eslint-runner.ts";
import {
  ESLINT_9_VERSION,
  eslint9CaseMismatches,
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "./eslint-9/eslint-9-engine.ts";
import { createEslintPort, type EslintToolchain } from "./eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "./eslint-toolchain.ts";

const DEVELOPMENT_PEERS: EslintToolchainPeers = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../../../../../..`,
  installForm: "source",
});

const ESLINT_9_PEERS: EslintToolchainPeers = {
  location: DEVELOPMENT_PEERS.location,
  modules: eslint9ToolchainModules,
};

const loadedEslint9Toolchain = async (): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({ peers: ESLINT_9_PEERS });
  assert(loaded.outcome === "ok", "the eslint-9 toolchain loads from the development install");
  assert(
    /^9\./.test(loaded.value.eslintVersion),
    `the eslint-9 toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

const eslintRunnerOnEslint9 = (): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslint9Toolchain().then(
      (toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain }),
    ),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: createDefaultFileTextPort({}),
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: eslint9PieceModules({ base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
        moduleExtension: ".ts",
      }),
  });

type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const disciplineOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
}): DisciplineFile => {
  const held = readHeldDiscipline({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(
    held.outcome === "ok",
    `${request.discipline} reads through the install's discipline reader`,
  );
  const discipline = held.value;
  assert(discipline.held === "present", `the install holds ${request.discipline}`);
  return discipline.file;
};

const rowsOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
  readonly mechanism: EngineId;
}): readonly ConformanceRow[] => {
  const discipline = disciplineOf(request);
  const piece = readLocatedPieceFile({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    mechanism: request.mechanism,
    discipline,
  });
  assert(
    piece.outcome === "ok",
    `${request.discipline} ${request.mechanism} piece.json reads through the rule-set reader`,
  );
  return piece.value.clauses.flatMap((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(
      definition?.kind === "mechanical",
      `${request.discipline}#${entry.clause} is a mechanical clause`,
    );
    const clause: RunnerClause = {
      address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
      anchor: definition.anchor,
      pieceRoot: entry.pieceRoot,
      settings: entry.settings,
      clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
      edition: entry.editions.default,
    };
    return casesByEdition({
      defaultEdition: clause.edition,
      cases: [...definition.cases.flag, ...definition.cases.allow],
    }).map(({ edition, cases }) => ({
      name:
        edition === entry.editions.default
          ? `${request.discipline}#${entry.clause}`
          : `${request.discipline}#${entry.clause} edition ${edition}`,
      clause: { ...clause, edition },
      cases,
    }));
  });
};

const conformanceRows = (request: {
  readonly disciplines: readonly string[];
  readonly mechanism: EngineId;
}): readonly ConformanceRow[] => {
  const fileText = createDefaultFileTextPort({});
  return request.disciplines.flatMap((discipline) =>
    rowsOf({ fileText, discipline, mechanism: request.mechanism }),
  );
};

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: {
        readonly base: string;
        readonly query: "?raw";
        readonly import: "default";
        readonly eager: true;
      },
    ) => Readonly<Record<string, string>>;
  }
}

const heldNames = readInstalledNames({
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  installRoot: RULE_SET_ROOT,
});

assert(heldNames.outcome === "ok", "the install's version 1 names read");

const legacyDisciplines = [
  ...new Set(
    heldNames.value.namedClauses
      .filter((clause) => clause.kind === "mechanical")
      .map(({ clause }) => clause.discipline),
  ),
].sort();

const ROWS = conformanceRows({
  disciplines: legacyDisciplines,
  mechanism: "eslint",
});

describe("the ESLint engine behind the compatibility check", () => {
  it("is the 9 line", () => {
    expect(ESLINT_9_VERSION).toMatch(/^9\./);
  });
});

describe("the team's own ESLint 9 run: every ESLint piece's shared cases hold under the supported ESLint 9 line, with ESLint 9's own core rules handed to any piece that wraps them (CD-47: the shipped plugin modules are the assertion's subject; nothing is spawned or written)", () => {
  it.each(ROWS)("$name flags and allows what its shared cases expect", async (row) => {
    expect(await eslint9CaseMismatches({ row })).toEqual([]);
  });
});

const CORE_RUNNER_ON_ESLINT_9 = runnerModuleSchema.parse(eslintRunnerOnEslint9());

describe("core's own governance run on the adopter's ESLint 9, through the runner's conformance path, holds every ESLint piece's shared cases (CD-47: the shipped runner and pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(
      await checkConformance({
        clause: row.clause,
        cases: row.cases,
        runner: CORE_RUNNER_ON_ESLINT_9,
      }),
    ).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
