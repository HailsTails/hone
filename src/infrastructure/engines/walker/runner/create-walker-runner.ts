import { z } from "zod";

import type { NamedEngineRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import type { EntryKindPort } from "../../../../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import { gatheredOutcomes } from "../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { CheckHit, CheckMeasurement } from "../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { CaseVerdict } from "../../../../domain/runner/runner-result-types.ts";
import { DEFAULT_TEST_FILES } from "../../../../domain/settings/test-files.ts";
import { checkHitSchema } from "../../protocol/checks/check-wire.ts";
import type {
  NamedChecksRunner,
  NamedChecksRunReport,
} from "../../protocol/checks/checks-runner-types.ts";
import { runnerResultSchema } from "../../protocol/runner-module/runner-result-schema.ts";
import { observeWalkerFile } from "./observe-walker-file.ts";
import type { DirectiveEscape } from "./pieces/type-directives.ts";
import { walkerPieceSettingsSchema } from "./pieces/walker-check-schema.ts";
import { CASE_ROOT, portsDisk, textsDisk } from "./pieces/walker-disk.ts";
import type { WalkerFile, WalkerRepository } from "./pieces/walker-piece.ts";
import {
  type PreparedWalkerPiece,
  prepareWalkerPieces,
  type SelectedWalkerBinding,
} from "./prepare-walker-pieces.ts";
import type { TypeScriptParsePort } from "./toolchain/typescript-parse.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

type WalkerPorts = {
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly parse: TypeScriptParsePort;
  readonly entryKind: EntryKindPort;
};

type BindingOrder = { readonly bindings: readonly CheckBinding[] };

type WalkerRunReport = Pick<
  NamedChecksRunReport,
  "hits" | "nativeExceptions" | "measured" | "inapplicable"
>;

type SettledBindings = {
  readonly selected: readonly SelectedWalkerBinding[];
  readonly escapes: readonly DirectiveEscape[];
};

const finishedHitsSchema = runnerResultSchema({ value: z.array(checkHitSchema).readonly() });

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

const thrownDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const settledBinding = (request: {
  readonly binding: CheckBinding;
  readonly path: PathPort;
}): Outcome<readonly SettledBindings[]> => {
  const settings = walkerPieceSettingsSchema.safeParse(request.binding.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.binding.pieceRoot, detail: settings.error.message });
  }
  return {
    outcome: "ok",
    value: [
      {
        selected: [
          {
            binding: request.binding,
            modulePath: request.path.join({
              segments: [request.binding.pieceRoot, settings.data.module],
            }),
          },
        ],
        escapes: [
          { check: request.binding.address, directives: settings.data.escapingDirectives ?? [] },
        ],
      },
    ],
  };
};

const settledBindings = (request: {
  readonly bindings: readonly CheckBinding[];
  readonly path: PathPort;
}): Outcome<SettledBindings> => {
  const settled = gatheredOutcomes({
    outcomes: request.bindings.map((binding) => settledBinding({ binding, path: request.path })),
  });
  if (settled.outcome === "failed") return settled;
  return {
    outcome: "ok",
    value: {
      selected: settled.value.flatMap((entry) => entry.selected),
      escapes: settled.value
        .flatMap((entry) => entry.escapes)
        .filter((directiveEscape) => directiveEscape.directives.length > 0),
    },
  };
};

type PreparedPieces = {
  readonly pieces: readonly PreparedWalkerPiece[];
  readonly escapes: readonly DirectiveEscape[];
};

const preparedPieces = (request: {
  readonly ports: WalkerPorts;
  readonly bindings: readonly CheckBinding[];
  readonly repository: WalkerRepository;
}): Promise<Outcome<PreparedPieces>> => {
  const settled = settledBindings({ bindings: request.bindings, path: request.ports.path });
  if (settled.outcome === "failed") return Promise.resolve(settled);
  return prepareWalkerPieces({
    selected: settled.value.selected,
    repository: request.repository,
    syntaxApi: request.ports.parse.syntaxApi,
    modules: request.ports.modules,
  }).then((pieces) =>
    pieces.outcome === "failed"
      ? pieces
      : { outcome: "ok", value: { pieces: pieces.value, escapes: settled.value.escapes } },
  );
};

const checkRank = (request: BindingOrder & { readonly hit: CheckHit }): number =>
  request.bindings.findIndex((binding) => binding.address === request.hit.check);

const inSourceOrder = (
  request: BindingOrder & { readonly hits: readonly CheckHit[] },
): readonly CheckHit[] =>
  [...request.hits].sort(
    (left, right) =>
      left.anchor.line - right.anchor.line ||
      left.anchor.column - right.anchor.column ||
      checkRank({ bindings: request.bindings, hit: left }) -
        checkRank({ bindings: request.bindings, hit: right }),
  );

const observedReport = (request: {
  readonly ports: WalkerPorts;
  readonly prepared: PreparedPieces;
  readonly bindings: readonly CheckBinding[];
  readonly file: WalkerFile;
  readonly includeApplicability?: true;
}): Outcome<readonly WalkerRunReport[]> => {
  const observed = observeWalkerFile({
    file: request.file,
    pieces: request.prepared.pieces,
    parse: request.ports.parse,
    escapes: request.prepared.escapes,
    ...(request.includeApplicability === true ? { includeApplicability: true } : {}),
  });
  if (observed.outcome === "failed") return observed;
  return {
    outcome: "ok",
    value: [
      {
        hits: inSourceOrder({ bindings: request.bindings, hits: observed.value.hits }),
        nativeExceptions: observed.value.nativeExceptions,
        inapplicable: (observed.value.inapplicable ?? []).map((check) => ({
          check,
          file: request.file.file,
        })),
        measured: observed.value.applicable.map((check): CheckMeasurement => ({
          check,
          file: request.file.file,
        })),
      },
    ],
  };
};

const finishedPiece = (request: {
  readonly piece: PreparedWalkerPiece;
}): Outcome<readonly CheckHit[]> => {
  const pieceRoot = request.piece.bindings[0]?.pieceRoot ?? request.piece.modulePath;
  try {
    const parsed = finishedHitsSchema.safeParse(request.piece.check.finish());
    if (!parsed.success) return pieceInvalid({ pieceRoot, detail: parsed.error.message });
    return parsed.data;
  } catch (thrown) {
    return pieceInvalid({ pieceRoot, detail: thrownDetail({ thrown }) });
  }
};

const walkedReport = (request: {
  readonly ports: WalkerPorts;
  readonly prepared: PreparedPieces;
  readonly bindings: readonly CheckBinding[];
  readonly files: readonly WalkerFile[];
  readonly includeApplicability?: true;
}): Outcome<WalkerRunReport> => {
  const observed: Outcome<readonly WalkerRunReport[]>[] = [];
  request.files.some((file) => {
    const fileReport = observedReport({ ...request, file });
    observed.push(fileReport);
    return fileReport.outcome === "failed";
  });
  const fromFiles = gatheredOutcomes({ outcomes: observed });
  if (fromFiles.outcome === "failed") return fromFiles;
  const finished = gatheredOutcomes({
    outcomes: request.prepared.pieces.map((piece) => finishedPiece({ piece })),
  });
  if (finished.outcome === "failed") return finished;
  return {
    outcome: "ok",
    value: {
      hits: [...fromFiles.value.flatMap((report) => report.hits), ...finished.value],
      nativeExceptions: fromFiles.value.flatMap((report) => report.nativeExceptions),
      measured: fromFiles.value.flatMap((report) => report.measured),
      ...(request.includeApplicability === true
        ? { inapplicable: fromFiles.value.flatMap((report) => report.inapplicable ?? []) }
        : {}),
    },
  };
};

const repositoryFile = (request: {
  readonly ports: WalkerPorts;
  readonly repoRoot: string;
  readonly file: RepoPath;
}): WalkerFile => ({
  file: request.file,
  readText: () => {
    const text = request.ports.fileText.read({
      path: request.ports.path.join({ segments: [request.repoRoot, request.file] }),
    });
    if (text.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "file-unreadable", file: request.file, detail: text.error.detail },
      };
    }
    return text;
  },
});

const runOverRepository = (request: {
  readonly ports: WalkerPorts;
  readonly run: NamedEngineRunRequest;
}): Promise<Outcome<WalkerRunReport>> => {
  const repository: WalkerRepository = {
    files: request.run.trackedPaths,
    exists: ({ file }) =>
      request.ports.fileText.exists({
        path: request.ports.path.join({ segments: [request.run.repoRoot, file] }),
      }),
    disk: portsDisk({
      root: request.run.repoRoot,
      entryKind: request.ports.entryKind,
      fileText: request.ports.fileText,
    }),
    testFiles: request.run.testFiles,
  };
  return preparedPieces({ ports: request.ports, bindings: request.run.bindings, repository }).then(
    (prepared) => {
      if (prepared.outcome === "failed") return prepared;
      return walkedReport({
        ports: request.ports,
        prepared: prepared.value,
        bindings: request.run.bindings,
        ...(request.run.includeApplicability === true ? { includeApplicability: true } : {}),
        files: request.run.trackedPaths.map((file) =>
          repositoryFile({ ports: request.ports, repoRoot: request.run.repoRoot, file }),
        ),
      });
    },
  );
};

const caseFile = (request: { readonly sourceCase: SourceCase }): WalkerFile => ({
  file: request.sourceCase.fileName,
  readText: () => ({ outcome: "ok", value: request.sourceCase.source }),
});

const caseVerdict = (request: {
  readonly ports: WalkerPorts;
  readonly binding: CheckBinding;
  readonly sourceCase: SourceCase;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const repository: WalkerRepository = {
    files: [request.sourceCase.fileName],
    exists: ({ file }) => (file === request.sourceCase.fileName ? "present" : "absent"),
    disk: textsDisk({
      root: CASE_ROOT,
      texts: { [request.sourceCase.fileName]: request.sourceCase.source },
    }),
    testFiles: DEFAULT_TEST_FILES,
  };
  return preparedPieces({ ports: request.ports, bindings: [request.binding], repository }).then(
    (prepared) => {
      if (prepared.outcome === "failed") return prepared;
      const report = walkedReport({
        ports: request.ports,
        prepared: prepared.value,
        bindings: [request.binding],
        files: [caseFile(request)],
      });
      if (report.outcome === "failed") return report;
      return {
        outcome: "ok",
        value: [
          {
            caseName: request.sourceCase.name,
            flaggedLines: [...new Set(report.value.hits.map((hit) => hit.anchor.line))],
          },
        ],
      };
    },
  );
};

const conformCases = (request: {
  readonly ports: WalkerPorts;
  readonly binding: CheckBinding;
  readonly cases: readonly SourceCase[];
}): Promise<Outcome<readonly CaseVerdict[]>> =>
  request.cases.reduce<Promise<Outcome<readonly CaseVerdict[]>>>(
    (pending, sourceCase) =>
      pending.then((collected) =>
        collected.outcome === "failed"
          ? collected
          : caseVerdict({ ports: request.ports, binding: request.binding, sourceCase }).then(
              (next) => gatheredOutcomes({ outcomes: [collected, next] }),
            ),
      ),
    Promise.resolve({ outcome: "ok", value: [] }),
  );

export const createWalkerRunner = (ports: WalkerPorts): NamedChecksRunner => ({
  run: async (request) => {
    const walked = await runOverRepository({ ports, run: request });
    return walked.outcome === "failed"
      ? walked
      : {
          outcome: "ok",
          value: {
            ...walked.value,
            projection: "none",
            slices: [],
            misnamedRuleIds: [],
            nestedConfigurations: [],
            unprojectedFolders: [],
          },
        };
  },
  conform: (request) => conformCases({ ports, binding: request.binding, cases: request.cases }),
  project: () => Promise.resolve({ outcome: "ok", value: [] }),
});
