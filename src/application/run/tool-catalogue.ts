import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { EngineBindingsOf } from "../ports/engine-bindings-repository.ts";
import type { SymptomCatalogueOf } from "../ports/symptom-catalogue-repository.ts";
import { boundCatalogueOf } from "./bound-catalogue.ts";
import { SYMPTOM_CATALOGUE_SEGMENTS } from "../../domain/language-layer/symptom-catalogue-location.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";

const unreadDetailOf = (request: { readonly error: VersionTwoLoadFailure }): string => {
  const { error } = request;
  return error.kind === "file-unreadable" || error.kind === "file-malformed" ? error.detail : error.kind;
};

export const toolCatalogueOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: Pick<PathPort, "join">;
  readonly installRoot: AbsolutePath;
  readonly symptomCatalogueOf: SymptomCatalogueOf;
  readonly engineBindingsOf: EngineBindingsOf;
}): Result<SymptomCatalogue, RunLoadFailure> => {
  const path = request.path.join({ segments: [request.installRoot, ...SYMPTOM_CATALOGUE_SEGMENTS] });
  const held = boundCatalogueOf({ ...request, ruleSetRoot: request.installRoot });
  if (held.outcome === "failed") {
    return { outcome: "failed", error: { kind: "catalogue-not-read", path, reason: { reason: "unreadable", detail: unreadDetailOf({ error: held.error }) } } };
  }
  return held.value.held === "catalogue"
    ? { outcome: "ok", value: held.value.catalogue }
    : { outcome: "failed", error: { kind: "catalogue-not-read", path, reason: { reason: "absent" } } };
};
