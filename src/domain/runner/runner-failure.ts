import type { RunnerFailure } from "./runner-failure-types.ts";

export type { PeerKind, RunnerFailure, UnavailablePeer, UnavailablePeers } from "./runner-failure-types.ts";

export const runnerInvalidOutput = (request: {
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "runner-invalid-output", detail: request.detail },
});

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

export const rejectedCall = (request: {
  readonly thrown: unknown;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } =>
  runnerInvalidOutput({ detail: `the runner call threw or rejected: ${thrownMessage(request)}` });
