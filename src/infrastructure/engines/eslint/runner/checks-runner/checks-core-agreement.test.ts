import { describe, expect, it } from "vitest";
import type { ChecksRunFailure as CoreChecksRunFailure, MisnamedRuleId as CoreMisnamedRuleId, NotReadyYetFailure as CoreNotReadyYetFailure } from "../../../protocol/checks/checks-runner-types.ts";
import type { ProjectionState } from "../../../protocol/runner-module/runner-result-schema.ts";
import type { RunLoadFailure } from "../../../../../domain/report/run-load-failure.ts";
import type { Equal } from "../../../protocol/runner-module/type-equality.ts";
import type { ChecksProjectionState, ChecksRunFailure, MisnamedRuleId, NotReadyYetFailure } from "./checks-run-types.ts";

const isNotReadyYetFailureAgreed: Equal<NotReadyYetFailure, CoreNotReadyYetFailure> = true;

const isChecksRunFailureAgreed: Equal<ChecksRunFailure, CoreChecksRunFailure> = true;

const isMisnamedRuleIdAgreed: Equal<MisnamedRuleId, CoreMisnamedRuleId> = true;

const isProjectionStateAgreed: Equal<ChecksProjectionState, ProjectionState> = true;

const isNotReadyYetFailureAReportedLoadFailure: NotReadyYetFailure extends Extract<RunLoadFailure, { readonly kind: "not-ready-yet" }> ? true : false = true;

describe("the runner's local copies of what core defines", () => {
  it("agrees with core on the failure, the misnamed id and the projection state the runner reports, checked where the types are compared", () => {
    expect([isNotReadyYetFailureAgreed, isChecksRunFailureAgreed, isMisnamedRuleIdAgreed, isProjectionStateAgreed, isNotReadyYetFailureAReportedLoadFailure]).toEqual([true, true, true, true, true]);
  });
});
