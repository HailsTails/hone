import type { VersionTwoLoadFailure } from "../../infrastructure/command-line/load-failure.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../../infrastructure/node/path-port.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import { createSymptomCatalogueRepository, SYMPTOM_CATALOGUE_SEGMENTS } from "../../infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../infrastructure/content-files/absolute-path.ts";
import type { Result } from "../../domain/result.ts";

const unreadDetailOf = (request: { readonly error: VersionTwoLoadFailure }): string => {
  const { error } = request;
  return error.kind === "file-unreadable" || error.kind === "file-malformed" ? error.detail : error.kind;
};

export const toolCatalogueOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly installRoot: AbsolutePath;
}): Result<SymptomCatalogue, RunLoadFailure> => {
  const path = request.path.join({ segments: [request.installRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  const held = createSymptomCatalogueRepository({ fileText: request.fileText, path: request.path, ruleSetRoot: request.installRoot }).read({});
  if (held.outcome === "failed") {
    return { outcome: "failed", error: { kind: "catalogue-not-read", path, reason: { reason: "unreadable", detail: unreadDetailOf({ error: held.error }) } } };
  }
  return held.value.held === "catalogue"
    ? { outcome: "ok", value: held.value.catalogue }
    : { outcome: "failed", error: { kind: "catalogue-not-read", path, reason: { reason: "absent" } } };
};
