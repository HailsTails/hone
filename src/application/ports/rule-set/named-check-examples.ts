import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import type { CheckPiece } from "../settings-sources.ts";

type ExamplesLookup = {
  readonly installRoot: AbsolutePath;
  readonly check: string;
  readonly engine: EngineId;
};

export type NamedCheckExamples = {
  readonly piece: CheckPiece;
  readonly examples: readonly SourceCase[];
};

export type NamedCheckExamplesRepository = {
  readonly read: (request: ExamplesLookup) => Result<NamedCheckExamples, VersionTwoLoadFailure>;
};
