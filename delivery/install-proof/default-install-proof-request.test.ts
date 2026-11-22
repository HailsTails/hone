import { describe, expect, it } from "vitest";

import { defaultInstallProofRequestOf } from "./default-install-proof-request.ts";
import { PROOF_CASES } from "./install-proof-plan.ts";

describe("defaultInstallProofRequestOf", () => {
  it("carries the module URL it is given and the plan's proof cases", () => {
    const request = defaultInstallProofRequestOf({
      moduleUrl: "file:///package/delivery/install-proof/install-proof.ts",
    });

    expect({ moduleUrl: request.moduleUrl, proofCases: request.proofCases }).toEqual({
      moduleUrl: "file:///package/delivery/install-proof/install-proof.ts",
      proofCases: PROOF_CASES,
    });
  });
});
