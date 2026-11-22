import type { AuthoriseRequest, Authorising } from "../application/ports/authorising.ts";
import type {
  AuthoriseArguments,
  ProjectArguments,
  PruneDebtArguments,
  RecordDebtArguments,
  SplitRecordsArguments,
} from "../application/ports/command/command-arguments.ts";
import type { RepositoryLocated } from "../application/ports/command/repository-located.ts";
import type { RecordsSplit } from "../application/ports/records/exception-repository.ts";
import type { DebtOutcome } from "../domain/records/debt/debt-effects.ts";
import type { PrunableDebt } from "../domain/records/debt/prunable-debt.ts";
import type { DebtPair } from "../domain/records/discipline-exceptions/debt-pair.ts";
import type { InheritedDebtOutcome } from "../domain/records/discipline-exceptions/inherited-debt.ts";
import type { LoadFailure } from "../domain/report/load-failure.ts";
import type { Result } from "../domain/result.ts";
import type { ProjectionWrite } from "../domain/runner/runner-result-types.ts";
import { VERSION_ONE_SETTINGS_FILE_NAME } from "../domain/settings/settings-file.ts";
import { authoriseRequestOf } from "../infrastructure/command-line/arguments/authorise-options.ts";
import {
  parseAuthoriseArguments,
  parseProjectArguments,
  parsePruneDebtArguments,
  parseRecordDebtArguments,
  parseSplitRecordsArguments,
} from "../infrastructure/command-line/arguments/command-arguments.ts";
import { projectCommandOf } from "../infrastructure/command-line/arguments/tool-invocations.ts";
import { installRootOf } from "../infrastructure/command-line/installation/install-root.ts";
import {
  type CommandOutcome,
  projectCommandOutcome,
} from "../infrastructure/command-line/outcomes/command-outcome.ts";
import {
  pruneDebtCommandOutcome,
  recordDebtCommandOutcome,
  splitRecordsCommandOutcome,
} from "../infrastructure/command-line/outcomes/record-command-outcomes.ts";
import { createRecordsStore } from "../infrastructure/hone-records-folder/writing/records-store.ts";
import { repoRootOf } from "../infrastructure/printed-report/check-locations.ts";
import {
  authorisingLines,
  debtOutcomeLine,
  projectNextLine,
  prunedDebtLine,
} from "../infrastructure/printed-report/records/record-command-lines.ts";
import { projectionsIn } from "../operations/project/run-project-command.ts";
import { versionTwoProjectedOf } from "../operations/project/version-two-project-command.ts";
import { debtPruned } from "../operations/prune-debt/run-prune-debt-command.ts";
import { adoptionDebt } from "../operations/record-debt/run-record-debt-command.ts";
import {
  type VersionTwoRecordInput,
  versionTwoAuthoriseOf,
  versionTwoPruneDebtOf,
  versionTwoRecordDebtOf,
} from "../operations/version-two-record-commands.ts";
import { loadFailed, loadResultOf, runFailed, type ToolCommand } from "./composed-command.ts";
import type { ToolInvocation, ToolPorts, VersionOneToolPorts } from "./tool-ports.ts";
import { runSettingsOver, versionOneRunAt, withShownPaths } from "./version-one-runs.ts";
import {
  repoRootOf as resolvedRepoRootOf,
  repositoryLocatedOf,
  stagesOverRepository,
  type VersionTwoRepositoryPorts,
} from "./version-two-repository.ts";

export type VersionTwoRecordPorts = VersionTwoRepositoryPorts &
  Pick<ToolPorts, "fileRemoval" | "recordsReader" | "recordsEditor">;

type AuthoriseParsed = { readonly repo: string; readonly authorising: AuthoriseRequest };

type RecordedDebt = {
  readonly outcomes: readonly DebtOutcome[];
  readonly projectCommand: string | undefined;
};

const linesOutcome = (request: { readonly lines: readonly string[] }): CommandOutcome => ({
  code: 0,
  text: request.lines.map((line) => `${line}\n`).join(""),
});

const recordInputOf = (request: {
  readonly ports: VersionTwoRecordPorts;
  readonly command: ToolInvocation;
  readonly located: RepositoryLocated;
  readonly baseRevision: string | undefined;
}): VersionTwoRecordInput => {
  const { ports, located } = request;
  const { fileText, path, git } = ports;
  return {
    stages: stagesOverRepository({
      ports,
      moduleUrl: request.command.moduleUrl,
      located,
      baseRevision: request.baseRevision,
    }),
    repoRoot: located.repoRoot,
    recordsSourceFor: ({ catalogue }) =>
      ports.recordsSourceOf({
        fileText,
        git,
        gitTree: ports.gitTree,
        directory: ports.directory,
        repoRoot: located.repoRoot,
        catalogue,
      }),
    recordsStoreOf: ({ repoRoot }) =>
      createRecordsStore({
        fileText,
        path,
        removal: ports.fileRemoval,
        directory: ports.directory,
        repoRoot,
      }),
    recordsReader: ports.recordsReader,
    recordsEditor: ports.recordsEditor,
  };
};

const parseAuthorise = (request: {
  readonly arguments: readonly string[];
}): Result<AuthoriseParsed, LoadFailure> => {
  const parsed = parseAuthoriseArguments(request);
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const authorising = authoriseRequestOf({ values: parsed.value.values });
  return authorising.outcome === "failed"
    ? authorising
    : { outcome: "ok", value: { repo: parsed.value.repo, authorising: authorising.value } };
};

export const PROJECT: ToolCommand<
  ProjectArguments,
  readonly ProjectionWrite[],
  VersionOneToolPorts
> = {
  parse: parseProjectArguments,
  run: ({ command, ports, parsed }) =>
    versionOneRunAt({
      ports,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
      run: (located) => projectionsIn({ ...ports, moduleUrl: command.moduleUrl, ...located }),
    }),
  print: ({ produced }) => projectCommandOutcome({ result: { outcome: "ok", value: produced } }),
};

export const PRUNE_DEBT: ToolCommand<PruneDebtArguments, readonly DebtPair[], VersionOneToolPorts> =
  {
    parse: parsePruneDebtArguments,
    run: ({ command, ports, parsed }) =>
      versionOneRunAt({
        ports,
        moduleUrl: command.moduleUrl,
        repo: parsed.repo,
        run: (located) =>
          debtPruned({
            ...ports,
            moduleUrl: command.moduleUrl,
            ...located,
            arguments: parsed,
            runSettingsOf: runSettingsOver(ports),
          }),
      }),
    print: ({ produced }) =>
      pruneDebtCommandOutcome({ result: { outcome: "ok", value: produced } }),
  };

export const RECORD_DEBT: ToolCommand<
  RecordDebtArguments,
  readonly InheritedDebtOutcome[],
  VersionOneToolPorts & Pick<ToolPorts, "gitTree">
> = {
  parse: parseRecordDebtArguments,
  run: ({ command, ports, parsed }) =>
    versionOneRunAt({
      ports,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
      run: (located) =>
        adoptionDebt({
          ...ports,
          moduleUrl: command.moduleUrl,
          ...located,
          arguments: parsed,
          exceptionRepository: ports.exceptionRepositoryOf({ repoRoot: located.repoRoot }),
        }),
    }),
  print: ({ produced }) => recordDebtCommandOutcome({ result: { outcome: "ok", value: produced } }),
};

export const SPLIT_RECORDS: ToolCommand<
  SplitRecordsArguments,
  RecordsSplit,
  Pick<ToolPorts, "path" | "fileText" | "exceptionRepositoryOf">
> = {
  parse: parseSplitRecordsArguments,
  run: ({ command, ports, parsed }) => {
    const { path, fileText } = ports;
    const repoRoot = repoRootOf({ path, fileText, repo: parsed.repo });
    if (repoRoot.outcome === "failed") {
      return Promise.resolve(loadFailed({ failure: repoRoot.error }));
    }
    return Promise.resolve(
      loadResultOf({
        result: withShownPaths({
          path,
          fileText,
          repoRoot: repoRoot.value,
          installRoot: installRootOf({ path, moduleUrl: command.moduleUrl }),
          run: ports.exceptionRepositoryOf({ repoRoot: repoRoot.value }).moveToSplitLayout(),
        }),
      }),
    );
  },
  print: ({ produced }) =>
    splitRecordsCommandOutcome({ result: { outcome: "ok", value: produced } }),
};

export const VERSION_TWO_NEEDED: ToolCommand<
  AuthoriseArguments,
  never,
  Pick<ToolPorts, "path" | "fileText">
> = {
  parse: parseAuthoriseArguments,
  run: ({ ports, parsed }) => {
    const repoRoot = resolvedRepoRootOf({ path: ports.path, repo: parsed.repo });
    if (repoRoot.outcome === "failed") {
      return Promise.resolve(loadFailed({ failure: repoRoot.error }));
    }
    const versionOnePresent =
      ports.fileText.exists({
        path: ports.path.join({ segments: [repoRoot.value, VERSION_ONE_SETTINGS_FILE_NAME] }),
      }) === "present";
    return Promise.resolve(
      runFailed({
        failure: versionOnePresent
          ? { kind: "upgrade-needed", path: VERSION_ONE_SETTINGS_FILE_NAME }
          : { kind: "config-absent", repo: repoRoot.value },
        repoRoot: repoRoot.value,
      }),
    );
  },
  print: ({ produced }) => produced,
};

export const VERSION_TWO_PROJECT: ToolCommand<
  ProjectArguments,
  readonly ProjectionWrite[],
  VersionTwoRepositoryPorts
> = {
  parse: parseProjectArguments,
  run: async ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
    });
    if (located.outcome === "failed") {
      return loadFailed({ failure: located.error });
    }
    const projected = await versionTwoProjectedOf({
      stages: stagesOverRepository({
        ports,
        moduleUrl: command.moduleUrl,
        located: located.value,
        baseRevision: undefined,
      }),
      fileText: ports.fileText,
      path: ports.path,
      repoRoot: located.value.repoRoot,
    });
    return projected.outcome === "failed"
      ? runFailed({ failure: projected.error, repoRoot: located.value.repoRoot })
      : projected;
  },
  print: ({ produced }) => projectCommandOutcome({ result: { outcome: "ok", value: produced } }),
};

export const VERSION_TWO_RECORD_DEBT: ToolCommand<
  RecordDebtArguments,
  RecordedDebt,
  VersionTwoRecordPorts
> = {
  parse: parseRecordDebtArguments,
  run: async ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
    });
    if (located.outcome === "failed") {
      return loadFailed({ failure: located.error });
    }
    const { repoRoot } = located.value;
    const recorded = await versionTwoRecordDebtOf({
      ...recordInputOf({
        ports,
        command,
        located: located.value,
        baseRevision: parsed.baseRevision,
      }),
      leave: parsed.leave,
    });
    if (recorded.outcome === "failed") {
      return runFailed({ failure: recorded.error, repoRoot });
    }
    if (!recorded.value.some((outcome) => outcome.effect === "recorded")) {
      return { outcome: "ok", value: { outcomes: recorded.value, projectCommand: undefined } };
    }
    const projectCommand = projectCommandOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repoRoot,
    });
    return projectCommand.outcome === "failed"
      ? loadFailed({ failure: projectCommand.error })
      : {
          outcome: "ok",
          value: { outcomes: recorded.value, projectCommand: projectCommand.value },
        };
  },
  print: ({ produced }) => {
    const outcomeLines = produced.outcomes.map((outcome) => debtOutcomeLine({ outcome }));
    return linesOutcome({
      lines:
        produced.projectCommand === undefined
          ? outcomeLines
          : [...outcomeLines, projectNextLine({ projectCommand: produced.projectCommand })],
    });
  },
};

export const VERSION_TWO_PRUNE_DEBT: ToolCommand<
  PruneDebtArguments,
  readonly PrunableDebt[],
  VersionTwoRecordPorts
> = {
  parse: parsePruneDebtArguments,
  run: async ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
    });
    if (located.outcome === "failed") {
      return loadFailed({ failure: located.error });
    }
    const pruned = await versionTwoPruneDebtOf({
      ...recordInputOf({
        ports,
        command,
        located: located.value,
        baseRevision: parsed.baseRevision,
      }),
      forfeiture: parsed.forfeiture,
    });
    return pruned.outcome === "failed"
      ? runFailed({ failure: pruned.error, repoRoot: located.value.repoRoot })
      : pruned;
  },
  print: ({ produced }) =>
    linesOutcome({ lines: produced.map((debt) => prunedDebtLine({ pruned: debt })) }),
};

export const AUTHORISE: ToolCommand<AuthoriseParsed, Authorising, VersionTwoRecordPorts> = {
  parse: parseAuthorise,
  run: ({ command, ports, parsed }) => {
    const located = repositoryLocatedOf({
      path: ports.path,
      moduleUrl: command.moduleUrl,
      repo: parsed.repo,
    });
    if (located.outcome === "failed") {
      return Promise.resolve(loadFailed({ failure: located.error }));
    }
    const authorised = versionTwoAuthoriseOf({
      ...recordInputOf({ ports, command, located: located.value, baseRevision: undefined }),
      authorising: parsed.authorising,
    });
    return Promise.resolve(
      authorised.outcome === "failed"
        ? runFailed({ failure: authorised.error, repoRoot: located.value.repoRoot })
        : authorised,
    );
  },
  print: ({ parsed, produced }) =>
    linesOutcome({
      lines: authorisingLines({
        address: parsed.authorising.answers,
        file: parsed.authorising.file,
        authorising: produced,
      }),
    }),
};
