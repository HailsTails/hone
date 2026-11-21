import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { disciplineFilePath, pieceFilePath, readDisciplineFile, readPieceFile } from "./rule-set-reader.ts";
import type { DisciplineFile, PieceFile } from "../../../domain/rule-set/rule-set-types.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { DisciplineId, MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import { runnerModuleSegmentsOf } from "../../node/modules/install-layout.ts";
import type { ModuleExtension } from "../../../application/ports/host/module-extension.ts";
import type { Result } from "../../../domain/result.ts";

export type Held<File> = { readonly held: "absent" } | { readonly held: "present"; readonly file: File };

export type RuleSetFiles = {
  readonly discipline: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly discipline: DisciplineId;
  }) => Result<Held<DisciplineFile>, LoadFailure>;
  readonly piece: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly discipline: DisciplineFile;
    readonly mechanism: MechanismId;
  }) => Result<Held<PieceFile>, LoadFailure>;
  readonly runner: (request: {
    readonly installRoot: AbsolutePath;
    readonly mechanism: MechanismId;
    readonly moduleExtension: ModuleExtension;
  }) => "present" | "absent";
};

const heldOf = <File>(request: { readonly presence: "present" | "absent"; readonly read: () => Result<File, LoadFailure> }): Result<Held<File>, LoadFailure> => {
  if (request.presence === "absent") {
    return { outcome: "ok", value: { held: "absent" } };
  }
  const read = request.read();
  return read.outcome === "failed" ? read : { outcome: "ok", value: { held: "present", file: read.value } };
};

export const createRuleSetFiles = (options: { readonly fileText: FileTextPort; readonly path: PathPort }): RuleSetFiles => ({
  discipline: ({ ruleSetRoot, discipline }) => {
    const location = { path: options.path, ruleSetRoot, discipline };
    return heldOf({
      presence: options.fileText.exists({ path: disciplineFilePath(location) }),
      read: () => readDisciplineFile({ ...location, fileText: options.fileText }),
    });
  },
  piece: ({ ruleSetRoot, installRoot, discipline, mechanism }) => {
    const location = { path: options.path, ruleSetRoot, installRoot, discipline: discipline.id, mechanism };
    return heldOf({
      presence: options.fileText.exists({ path: pieceFilePath(location) }),
      read: () => readPieceFile({ ...location, fileText: options.fileText, discipline }),
    });
  },
  runner: ({ installRoot, mechanism, moduleExtension }) =>
    options.fileText.exists({ path: options.path.join({ segments: runnerModuleSegmentsOf({ installRoot, mechanism, moduleExtension }) }) }),
});
