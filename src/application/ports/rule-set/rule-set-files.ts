import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { DisciplineId, EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { DisciplineFile, PieceFile } from "../../../domain/rule-set/rule-set-types.ts";

export type Held<File> =
  | { readonly held: "absent" }
  | { readonly held: "present"; readonly file: File };

export type LocatedPieceFile = Omit<PieceFile, "clauses"> & {
  readonly clauses: readonly (PieceFile["clauses"][number] & { readonly pieceRoot: string })[];
};

export type RuleSetFiles = {
  readonly disciplineFile: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly discipline: DisciplineId;
  }) => Result<Held<DisciplineFile>, VersionTwoLoadFailure>;
  readonly pieceFile: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly mechanism: EngineId;
    readonly discipline: DisciplineFile;
  }) => Result<LocatedPieceFile, VersionTwoLoadFailure>;
};
