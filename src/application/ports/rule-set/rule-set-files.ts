import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { DisciplineId, MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import type { DisciplineFile, PieceFile } from "../../../domain/rule-set/rule-set-types.ts";

export type RuleSetFiles = {
  readonly disciplineFile: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly discipline: DisciplineId;
  }) => Result<DisciplineFile, VersionTwoLoadFailure>;
  readonly pieceFile: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly mechanism: MechanismId;
    readonly discipline: DisciplineFile;
  }) => Result<PieceFile, VersionTwoLoadFailure>;
};
