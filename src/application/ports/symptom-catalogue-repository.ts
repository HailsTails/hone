import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { Result } from "../../domain/result.ts";
import type { ContentHolding } from "../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { FileTextPort } from "./file-system/file-text-port.ts";
import type { PathPort } from "./host/path-port.ts";

export type SymptomCatalogueRepository = {
  readonly read: (request: Record<string, never>) => Result<ContentHolding, VersionTwoLoadFailure>;
};

export type SymptomCatalogueOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
}) => SymptomCatalogueRepository;
