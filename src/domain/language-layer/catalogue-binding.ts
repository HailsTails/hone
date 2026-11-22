import type { Result } from "../result.ts";
import type { CatalogueName } from "./catalogue-name.ts";
import type { LegacyClauseAddress, NamedCheckAddress } from "../rule-set/clause-address-types.ts";
import type { ClauseId, DisciplineId } from "../rule-set/identifier-types.ts";
import { checkAddressTextOf } from "./check-address-text.ts";
import type { CatalogueContent, CatalogueHolding, Check, CheckContent, ContentHolding, Engine, SymptomCatalogue } from "./symptom-catalogue.ts";

export type PieceClauseKey = `${DisciplineId}#${ClauseId}` | `${CatalogueName}#${CatalogueName}`;

export type EngineBindings = ReadonlyMap<PieceClauseKey, readonly Engine[]>;

type BoundCheck = { readonly check: CheckContent; readonly engines: readonly Engine[] };

export const pieceClauseKeyOf = (request: Pick<LegacyClauseAddress, "discipline" | "clause"> | Pick<NamedCheckAddress, "symptom" | "check">): PieceClauseKey =>
  "symptom" in request ? `${request.symptom}#${request.check}` : `${request.discipline}#${request.clause}`;

const boundCheckOf = (request: { readonly check: CheckContent; readonly bindings: EngineBindings }): BoundCheck => ({
  check: request.check,
  engines: request.bindings.get(pieceClauseKeyOf(request.check.clause)) ?? [],
});

const checkOf = (bound: BoundCheck): Check => ({ ...bound.check, engines: bound.engines });

export const catalogueBoundTo = (request: { readonly content: CatalogueContent; readonly bindings: EngineBindings }): Result<SymptomCatalogue, string> => {
  const bound = request.content.checks.map((check) => boundCheckOf({ check, bindings: request.bindings }));
  const unrun = bound.filter((each) => each.engines.length === 0).map((each) => checkAddressTextOf({ check: each.check }));
  return unrun.length > 0
    ? { outcome: "failed", error: `no piece runs the clause of ${unrun.join(", ")}` }
    : { outcome: "ok", value: { ...request.content, checks: bound.map(checkOf) } };
};

export const holdingBoundTo = (request: { readonly holding: ContentHolding; readonly bindings: EngineBindings }): Result<CatalogueHolding, string> => {
  if (request.holding.held === "none") {
    return { outcome: "ok", value: request.holding };
  }
  const catalogue = catalogueBoundTo({ content: request.holding.content, bindings: request.bindings });
  return catalogue.outcome === "failed" ? catalogue : { outcome: "ok", value: { held: "catalogue", catalogue: catalogue.value } };
};
