import type { BaseRevisionAvailability } from "../../repository/base-revision-availability.ts";
import type { RenamedPaths } from "../../repository/renamed-path.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { StructuralExceptionEntry } from "./exception-entry.ts";
import { whyChainFormOf } from "./version-one-why-chain.ts";

export type ExceptionBaseline =
  | { readonly measured: "no"; readonly base: BaseRevisionAvailability }
  | {
      readonly measured: "yes";
      readonly entriesAtBase: readonly StructuralExceptionEntry[];
      readonly sourceTextsAtBase: ReadonlyMap<RepoPath, string>;
      readonly basePathOfRenamed: RenamedPaths;
    };

export const UNMEASURED_EXCEPTION_BASELINE: ExceptionBaseline = {
  measured: "no",
  base: { state: "not-given" },
};

export type MeasuredBaseline = Extract<ExceptionBaseline, { readonly measured: "yes" }>;

export type JudgedEvidence = { readonly whyChain?: unknown; readonly provenance?: unknown };

const evidenceJudgedBy = (request: { readonly evidence: JudgedEvidence }): "itself" | "the-base" =>
  (
    request.evidence.whyChain === undefined
      ? request.evidence.provenance === undefined
      : whyChainFormOf({ chain: request.evidence.whyChain }) === "causal"
  )
    ? "itself"
    : "the-base";

export const judgedAtBase = <Judged>(request: {
  readonly evidence: JudgedEvidence;
  readonly baseline: ExceptionBaseline;
  readonly inFull: () => Judged;
  readonly unjudged: () => Judged;
  readonly againstBase: (base: MeasuredBaseline) => Judged;
}): Judged => {
  if (evidenceJudgedBy(request) === "itself") {
    return request.inFull();
  }
  return request.baseline.measured === "no"
    ? request.unjudged()
    : request.againstBase(request.baseline);
};

export type AuthorisationStanding = "established" | "provisional";

export const authorisationStandingOf = (request: {
  readonly record: JudgedEvidence;
  readonly baseline: ExceptionBaseline;
}): AuthorisationStanding =>
  judgedAtBase({
    evidence: request.record,
    baseline: request.baseline,
    inFull: () => "established",
    unjudged: () => "provisional",
    againstBase: () => "established",
  });
