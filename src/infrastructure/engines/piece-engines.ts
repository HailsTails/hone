import type { EngineBindingsRepository } from "../../application/ports/engine-bindings-repository.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import type { EngineBindings } from "../../domain/language-layer/catalogue-binding.ts";
import {
  type AddressedCheck,
  type CheckAddressText,
  checkAddressTextOf,
  checkNamesOf,
} from "../../domain/language-layer/check-address-text.ts";
import type { Engine } from "../../domain/language-layer/symptom-catalogue.ts";
import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import { ENGINE_REGISTRY } from "./engine-registry.ts";
import { readNamedPiece } from "./named-piece.ts";

type PieceSource = {
  readonly fileText: Pick<FileTextPort, "exists" | "read">;
  readonly path: Pick<PathPort, "join">;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

type Binding = { readonly address: CheckAddressText; readonly engine: Engine };

type Bound = Result<readonly Binding[], VersionTwoLoadFailure>;

const allBound = (bounds: readonly Bound[]): Bound => {
  const failure = bounds.find((bound) => bound.outcome === "failed");
  return (
    failure ?? {
      outcome: "ok",
      value: bounds.flatMap((bound) => (bound.outcome === "ok" ? bound.value : [])),
    }
  );
};

const bindingsByAddress = (bindings: readonly Binding[]): EngineBindings => {
  const byAddress = new Map<CheckAddressText, readonly Engine[]>();
  bindings.forEach(({ address, engine }) => {
    const engines = byAddress.get(address) ?? [];
    if (!engines.some(({ name }) => name === engine.name)) {
      byAddress.set(address, [...engines, engine]);
    }
  });
  return byAddress;
};

const namedBindingOf = (request: {
  readonly source: PieceSource;
  readonly engine: Engine;
  readonly check: AddressedCheck;
}): Bound => {
  const address = checkAddressTextOf(request);
  const names = checkNamesOf({ text: address });
  if (names === undefined) {
    return { outcome: "ok", value: [] };
  }
  const piece = readNamedPiece({ ...request.source, ...names, mechanism: request.engine.name });
  if (piece.outcome === "ok") {
    return { outcome: "ok", value: [{ address, engine: request.engine }] };
  }
  return piece.error.kind === "piece-missing" ? { outcome: "ok", value: [] } : piece;
};

const readEngineBindings = (
  source: PieceSource,
  checks: readonly AddressedCheck[],
): Result<EngineBindings, VersionTwoLoadFailure> => {
  const bound = allBound(
    ENGINE_REGISTRY.flatMap((engine) =>
      checks.map((check) => namedBindingOf({ source, engine, check })),
    ),
  );
  return bound.outcome === "failed"
    ? bound
    : { outcome: "ok", value: bindingsByAddress(bound.value) };
};

export const createEngineBindingsRepository = (options: PieceSource): EngineBindingsRepository => ({
  read: (request) => readEngineBindings(options, request.checks),
});
