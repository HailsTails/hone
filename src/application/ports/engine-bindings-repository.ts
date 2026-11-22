import type { EngineBindings } from "../../domain/language-layer/catalogue-binding.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { FileTextPort } from "./file-system/file-text-port.ts";
import type { PathPort } from "./host/path-port.ts";

export type EngineBindingsRepository = {
  readonly read: (request: Record<string, never>) => Result<EngineBindings, VersionTwoLoadFailure>;
};

export type EngineBindingsOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}) => EngineBindingsRepository;
