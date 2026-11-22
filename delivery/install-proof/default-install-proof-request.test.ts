import { describe, expect, it } from "vitest";
import { defaultInstallProofRequestOf } from "./default-install-proof-request.ts";
import { PROOF_CASES } from "./install-proof-plan.ts";

describe("defaultInstallProofRequestOf", () => {
  it("carries the module URL it is given and the plan's proof cases", () => {
    const request = defaultInstallProofRequestOf({ moduleUrl: "file:///package/delivery/install-proof/install-proof.ts" });

    expect({ moduleUrl: request.moduleUrl, proofCases: request.proofCases }).toEqual({
      moduleUrl: "file:///package/delivery/install-proof/install-proof.ts",
      proofCases: PROOF_CASES,
    });
  });

  it("holds the real path port, joining a single segment to itself", () => {
    const request = defaultInstallProofRequestOf({ moduleUrl: "file:///a.ts" });

    expect(request.path.join({ segments: ["alpha"] })).toBe("alpha");
  });

  it("holds a tarball packer that packs", () => {
    const request = defaultInstallProofRequestOf({ moduleUrl: "file:///a.ts" });

    expect(request.packer.pack).toBeTypeOf("function");
  });
});
