import type { DirectoryPort } from "../../../src/application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../src/domain/gathered-outcomes.ts";
import { checkNamesOf } from "../../../src/domain/language-layer/check-address-text.ts";
import type { Result } from "../../../src/domain/result.ts";
import type { EngineId } from "../../../src/domain/rule-set/identifier-types.ts";
import { enginesFolderSegmentsOf } from "../../../src/domain/rule-set/piece-folder.ts";
import { ENGINE_REGISTRY } from "../../../src/infrastructure/engines/engine-registry.ts";
import { readNamedPiece } from "../../../src/infrastructure/engines/named-piece.ts";
import type { ListedPiece } from "./listed-piece.ts";

type PieceFolders = {
  readonly repoRoot: string;
  readonly directory: Pick<DirectoryPort, "list">;
  readonly fileText: Pick<FileTextPort, "exists" | "read">;
  readonly path: Pick<PathPort, "join" | "resolve">;
};

const PIECE_FILE = "piece.json";

const listFolders = (
  request: PieceFolders & { readonly segments: readonly string[] },
): Result<readonly string[], string> => {
  const folder = request.path.resolve({ path: request.path.join(request) });
  if (folder.outcome === "failed") {
    return { outcome: "failed", error: `${folder.error.path}: ${folder.error.kind}` };
  }
  const entries = request.directory.list({ path: folder.value });
  return entries.outcome === "failed"
    ? { outcome: "failed", error: `${entries.error.path}: ${entries.error.detail}` }
    : {
        outcome: "ok",
        value: entries.value.flatMap(({ name, kind }) => (kind === "directory" ? [name] : [])),
      };
};

const readListedPiece = (
  request: PieceFolders & {
    readonly engine: EngineId;
    readonly symptom: string;
    readonly check: string;
  },
): Result<ListedPiece, string> => {
  const { engine, repoRoot } = request;
  const check = `${request.symptom}#${request.check}` as const;
  const names = checkNamesOf({ text: check });
  if (names === undefined) {
    return { outcome: "failed", error: `${check} is not a check address` };
  }
  const piece = readNamedPiece({
    ...request,
    ...names,
    installRoot: repoRoot,
    ruleSetRoot: repoRoot,
    mechanism: engine,
  });
  return piece.outcome === "failed"
    ? { outcome: "failed", error: `${check} on ${engine}: ${piece.error.kind}` }
    : { outcome: "ok", value: { engine, check, editions: piece.value.editions.declared } };
};

const readPiecesOfSymptom = (
  request: PieceFolders & {
    readonly engine: EngineId;
    readonly symptom: string;
    readonly symptomSegments: readonly string[];
  },
): Result<readonly ListedPiece[], string> => {
  const checks = listFolders({ ...request, segments: request.symptomSegments });
  if (checks.outcome === "failed") {
    return checks;
  }
  const pieces = checks.value.filter(
    (check) =>
      request.fileText.exists({
        path: request.path.join({ segments: [...request.symptomSegments, check, PIECE_FILE] }),
      }) === "present",
  );
  return gatheredOutcomes({
    outcomes: pieces.map((check) =>
      listedOutcome({ outcome: readListedPiece({ ...request, check }) }),
    ),
  });
};

const readPiecesOfEngine = (
  request: PieceFolders & { readonly engine: EngineId },
): Result<readonly ListedPiece[], string> => {
  const { engine, repoRoot } = request;
  const segments = [
    repoRoot,
    ...enginesFolderSegmentsOf({ ruleSetRoot: repoRoot, installRoot: repoRoot }),
    engine,
  ];
  const symptoms = listFolders({ ...request, segments });
  return symptoms.outcome === "failed"
    ? symptoms
    : gatheredOutcomes({
        outcomes: symptoms.value.map((symptom) =>
          readPiecesOfSymptom({ ...request, symptom, symptomSegments: [...segments, symptom] }),
        ),
      });
};

export const readListedPieces = (request: PieceFolders): Result<readonly ListedPiece[], string> =>
  gatheredOutcomes({
    outcomes: ENGINE_REGISTRY.map(({ name }) => readPiecesOfEngine({ ...request, engine: name })),
  });
