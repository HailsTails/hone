import type { Engine } from "../language-layer/symptom-catalogue.ts";
import type { EngineId } from "../rule-set/identifier-types.ts";
import type { EngineNaming, RunLoadFailure, RunLoadFailureSource } from "./run-load-failure.ts";

type EnginesRequest = { readonly engines: readonly Engine[] };

const engineNamingOf = (
  request: EnginesRequest & { readonly mechanism: EngineId },
): EngineNaming => {
  const engine = request.engines.find((candidate) => candidate.name === request.mechanism);
  return engine === undefined
    ? { named: "mechanism", mechanism: request.mechanism }
    : { named: "engine", engine };
};

const engineNameOf = (request: EnginesRequest & { readonly mechanism: EngineId }): string => {
  const naming = engineNamingOf(request);
  return naming.named === "engine" ? naming.engine.name : naming.mechanism;
};

export type VersionOneFailureSource = Extract<
  RunLoadFailureSource,
  {
    readonly kind:
      | "selection-absent"
      | "unknown-discipline"
      | "unknown-clause"
      | "judgement-clause-selected"
      | "judgement-clause-listed"
      | "duplicate-clause"
      | "mechanism-not-allowed"
      | "runner-missing"
      | "runner-invalid"
      | "runner-failed"
      | "piece-missing";
  }
>;

export const mapVersionOneSourceToFailure = (
  request: EnginesRequest & { readonly source: VersionOneFailureSource },
): RunLoadFailure => {
  const { source, engines } = request;
  switch (source.kind) {
    case "selection-absent":
      return { kind: "config-absent", repo: source.repo };
    case "unknown-discipline":
    case "unknown-clause":
      return { kind: "unknown-check", check: source.address };
    case "judgement-clause-selected":
    case "judgement-clause-listed":
      return { kind: "review-only-listed", check: source.address };
    case "duplicate-clause":
      return {
        kind: "duplicate-check",
        key: "checks",
        check: source.address,
        prefixedCheck: source.prefixedAddress,
      };
    case "mechanism-not-allowed":
      return {
        kind: "engine-not-allowed",
        check: source.address,
        engine: engineNameOf({ engines, mechanism: source.mechanism }),
        allowed: { stated: "by-rule-set" },
      };
    case "runner-missing":
      return {
        kind: "engine-missing",
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
      };
    case "runner-invalid":
      return {
        kind: "engine-invalid",
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
        detail: source.detail,
      };
    case "runner-failed":
      return {
        kind: "engine-failed",
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
        failure: source.failure,
      };
    case "piece-missing":
      return {
        kind: "check-missing",
        check: source.address,
        engine: engineNamingOf({ engines, mechanism: source.mechanism }),
      };
  }
};
