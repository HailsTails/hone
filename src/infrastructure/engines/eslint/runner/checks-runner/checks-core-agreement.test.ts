import { describe, expect, it } from "vitest";

import type { MisnamedRuleId as CoreMisnamedRuleId } from "../../../../../domain/runner/checks-run-report.ts";
import type { ProjectionState } from "../../../../../domain/runner/runner-result-types.ts";
import type { ChecksRunFailure as CoreChecksRunFailure } from "../../../protocol/checks/checks-runner-types.ts";
import type { Equal } from "../../../protocol/runner-module/type-equality.ts";
import type {
  ChecksProjectionState,
  ChecksRunFailure,
  MisnamedRuleId,
} from "./checks-run-types.ts";

const isChecksRunFailureAgreed: Equal<ChecksRunFailure, CoreChecksRunFailure> = true;

const isMisnamedRuleIdAgreed: Equal<MisnamedRuleId, CoreMisnamedRuleId> = true;

const isProjectionStateAgreed: Equal<ChecksProjectionState, ProjectionState> = true;

describe("the runner's local copies of what core defines", () => {
  it("agrees with core on the failure, the misnamed id and the projection state the runner reports, checked where the types are compared", () => {
    expect([isChecksRunFailureAgreed, isMisnamedRuleIdAgreed, isProjectionStateAgreed]).toEqual([
      true,
      true,
      true,
    ]);
  });
});
