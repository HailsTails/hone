import type { WhyChain } from "../why-chain.ts";

export type VersionOneWhyChain = {
  readonly whys: WhyChain["whys"];
  readonly rootCause: string;
  readonly rootCheck: string;
  readonly readback: string;
  readonly owner: string;
};

export type LegacyWhyChain = {
  readonly whys: WhyChain["whys"];
  readonly rootCause: string;
  readonly owner: string;
  readonly rootCheck?: never;
  readonly readback?: never;
};

export type RecordedWhyChain = VersionOneWhyChain | LegacyWhyChain;

export type WhyChainForm = "causal" | "legacy";

export const whyChainFormOf = (request: { readonly chain: unknown }): WhyChainForm =>
  typeof request.chain === "object" &&
  request.chain !== null &&
  !Array.isArray(request.chain) &&
  !("rootCheck" in request.chain) &&
  !("readback" in request.chain)
    ? "legacy"
    : "causal";
