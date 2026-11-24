import type { VersionTwoLoadFailure } from "../../../src/domain/report/load-failure.ts";
import type { Result } from "../../../src/domain/result.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import type { VersionOneNames } from "../../../src/infrastructure/disciplines-file/version-one-names.ts";

export type CatalogueClausesPort = {
  readonly read: (request: {
    readonly names: VersionOneNames;
  }) => Result<CatalogueFile["clauses"], VersionTwoLoadFailure>;
};
