import { z } from "zod";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type {
  RunnerClause,
  RunRequest,
  StandaloneRunner,
} from "../../protocol/runner-module/runner-module-schema.ts";
import { hitSchema, runnerResultSchema } from "../../protocol/runner-module/runner-result-schema.ts";
import type { CaseVerdict, Hit, MeasuredPair } from "../../../../domain/runner/runner-result-types.ts";
import type { StandaloneRunReport } from "../../protocol/runner-module/standalone-run-report-schema.ts";
import type { EntryKindPort } from "../../../node/file-system/file-system-port.ts";
import type { FileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import type { PathPort } from "../../../node/path-port.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import { sameClauseAddress } from "../../../discipline-exceptions-folder/clause-address.ts";
import type { RepoPath } from "../../../hone-records-folder/repo-path.ts";
import { gatheredOutcomes } from "../../../../domain/gathered-outcomes.ts";
import type { Result } from "../../../../domain/result.ts";
import { observeWalkerFile } from "./observe-walker-file.ts";
import {
  type PreparedWalkerPiece,
  prepareWalkerPieces,
  type SelectedWalkerClause,
} from "./prepare-walker-pieces.ts";
import type { DirectiveEscape } from "./pieces/type-directives.ts";
import type { TypeScriptParsePort } from "./toolchain/typescript-parse.ts";
import { walkerPieceSettingsSchema } from "./pieces/walker-check-schema.ts";
import { CASE_ROOT, portsDisk, textsDisk } from "./pieces/walker-disk.ts";
import type { WalkerFile, WalkerRepository } from "./pieces/walker-piece.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

type WalkerPorts = {
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly parse: TypeScriptParsePort;
  readonly entryKind: EntryKindPort;
};

type ClauseOrder = { readonly clauses: readonly RunnerClause[] };

type WalkerRunReport = Required<StandaloneRunReport>;

type SettledClauses = {
  readonly selected: readonly SelectedWalkerClause[];
  readonly escapes: readonly DirectiveEscape[];
};

const finishedHitsSchema = runnerResultSchema({ value: z.array(hitSchema).readonly() });

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

const thrownDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const settledClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
}): Outcome<readonly SettledClauses[]> => {
  const settings = walkerPieceSettingsSchema.safeParse(request.clause.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: settings.error.message });
  }
  return {
    outcome: "ok",
    value: [
      {
        selected: [
          {
            clause: request.clause,
            modulePath: request.path.join({ segments: [request.clause.pieceRoot, settings.data.module] }),
          },
        ],
        escapes: [{ clause: request.clause.address, directives: settings.data.escapingDirectives ?? [] }],
      },
    ],
  };
};

const settledClauses = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<SettledClauses> => {
  const settled = gatheredOutcomes({ outcomes: request.clauses.map((clause) => settledClause({ clause, path: request.path })) });
  if (settled.outcome === "failed") return settled;
  return {
    outcome: "ok",
    value: {
      selected: settled.value.flatMap((entry) => entry.selected),
      escapes: settled.value.flatMap((entry) => entry.escapes).filter((directiveEscape) => directiveEscape.directives.length > 0),
    },
  };
};

type PreparedPieces = { readonly pieces: readonly PreparedWalkerPiece[]; readonly escapes: readonly DirectiveEscape[] };

const preparedPieces = (request: {
  readonly ports: WalkerPorts;
  readonly clauses: readonly RunnerClause[];
  readonly repository: WalkerRepository;
}): Promise<Outcome<PreparedPieces>> => {
  const settled = settledClauses({ clauses: request.clauses, path: request.ports.path });
  if (settled.outcome === "failed") return Promise.resolve(settled);
  return prepareWalkerPieces({
    selected: settled.value.selected,
    repository: request.repository,
    syntaxApi: request.ports.parse.syntaxApi,
    modules: request.ports.modules,
  }).then((pieces) =>
    pieces.outcome === "failed" ? pieces : { outcome: "ok", value: { pieces: pieces.value, escapes: settled.value.escapes } },
  );
};

const clauseRank = (request: ClauseOrder & { readonly hit: Hit }): number =>
  request.clauses.findIndex(
    (clause) => sameClauseAddress({ left: clause.address, right: request.hit.clause }) === "same",
  );

const inSourceOrder = (request: ClauseOrder & { readonly hits: readonly Hit[] }): readonly Hit[] =>
  [...request.hits].sort(
    (left, right) =>
      left.anchor.line - right.anchor.line ||
      left.anchor.column - right.anchor.column ||
      clauseRank({ clauses: request.clauses, hit: left }) - clauseRank({ clauses: request.clauses, hit: right }),
  );

const observedReport = (request: {
  readonly ports: WalkerPorts;
  readonly prepared: PreparedPieces;
  readonly clauses: readonly RunnerClause[];
  readonly file: WalkerFile;
}): Outcome<readonly WalkerRunReport[]> => {
  const observed = observeWalkerFile({
    file: request.file,
    pieces: request.prepared.pieces,
    parse: request.ports.parse,
    escapes: request.prepared.escapes,
  });
  if (observed.outcome === "failed") return observed;
  return {
    outcome: "ok",
    value: [
      {
        hits: inSourceOrder({ clauses: request.clauses, hits: observed.value.hits }),
        nativeExceptions: observed.value.nativeExceptions,
        measured: observed.value.applicable.map((clause): MeasuredPair => ({ clause, file: request.file.file })),
      },
    ],
  };
};

const finishedPiece = (request: { readonly piece: PreparedWalkerPiece }): Outcome<readonly Hit[]> => {
  const pieceRoot = request.piece.clauses[0]?.pieceRoot ?? request.piece.modulePath;
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
  readonly clauses: readonly RunnerClause[];
  readonly files: readonly WalkerFile[];
}): Outcome<WalkerRunReport> => {
  const observed: Outcome<readonly WalkerRunReport[]>[] = [];
  request.files.some((file) => {
    const fileReport = observedReport({ ...request, file });
    observed.push(fileReport);
    return fileReport.outcome === "failed";
  });
  const fromFiles = gatheredOutcomes({ outcomes: observed });
  if (fromFiles.outcome === "failed") return fromFiles;
  const finished = gatheredOutcomes({ outcomes: request.prepared.pieces.map((piece) => finishedPiece({ piece })) });
  if (finished.outcome === "failed") return finished;
  return {
    outcome: "ok",
    value: {
      hits: [...fromFiles.value.flatMap((report) => report.hits), ...finished.value],
      nativeExceptions: fromFiles.value.flatMap((report) => report.nativeExceptions),
      measured: fromFiles.value.flatMap((report) => report.measured),
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
      return { outcome: "failed", error: { kind: "file-unreadable", file: request.file, detail: text.error.detail } };
    }
    return text;
  },
});

const runOverRepository = (request: {
  readonly ports: WalkerPorts;
  readonly run: RunRequest;
}): Promise<Outcome<WalkerRunReport>> => {
  const repository: WalkerRepository = {
    files: request.run.trackedPaths,
    exists: ({ file }) =>
      request.ports.fileText.exists({
        path: request.ports.path.join({ segments: [request.run.repoRoot, file] }),
      }),
    disk: portsDisk({ root: request.run.repoRoot, entryKind: request.ports.entryKind, fileText: request.ports.fileText }),
  };
  return preparedPieces({ ports: request.ports, clauses: request.run.clauses, repository }).then((prepared) => {
    if (prepared.outcome === "failed") return prepared;
    return walkedReport({
      ports: request.ports,
      prepared: prepared.value,
      clauses: request.run.clauses,
      files: request.run.trackedPaths.map((file) =>
        repositoryFile({ ports: request.ports, repoRoot: request.run.repoRoot, file }),
      ),
    });
  });
};

const caseFile = (request: { readonly sourceCase: SourceCase }): WalkerFile => ({
  file: request.sourceCase.fileName,
  readText: () => ({ outcome: "ok", value: request.sourceCase.source }),
});

const caseVerdict = (request: {
  readonly ports: WalkerPorts;
  readonly clause: RunnerClause;
  readonly sourceCase: SourceCase;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const repository: WalkerRepository = {
    files: [request.sourceCase.fileName],
    exists: ({ file }) => (file === request.sourceCase.fileName ? "present" : "absent"),
    disk: textsDisk({ root: CASE_ROOT, texts: { [request.sourceCase.fileName]: request.sourceCase.source } }),
  };
  return preparedPieces({ ports: request.ports, clauses: [request.clause], repository }).then((prepared) => {
    if (prepared.outcome === "failed") return prepared;
    const report = walkedReport({
      ports: request.ports,
      prepared: prepared.value,
      clauses: [request.clause],
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
  });
};

const conformCases = (request: {
  readonly ports: WalkerPorts;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
}): Promise<Outcome<readonly CaseVerdict[]>> =>
  request.cases.reduce<Promise<Outcome<readonly CaseVerdict[]>>>(
    (pending, sourceCase) =>
      pending.then((collected) =>
        collected.outcome === "failed"
          ? collected
          : caseVerdict({ ports: request.ports, clause: request.clause, sourceCase }).then((next) =>
              gatheredOutcomes({ outcomes: [collected, next] }),
            ),
      ),
    Promise.resolve({ outcome: "ok", value: [] }),
  );

export const createWalkerRunner = (ports: WalkerPorts): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: (request) => runOverRepository({ ports, run: request }),
  conform: (request) => conformCases({ ports, clause: request.clause, cases: request.cases }),
});
