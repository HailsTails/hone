import { describe, expect, it } from "vitest";
import { causalProblemsOf } from "../src/infrastructure/hone-records-folder/why-chain.ts";
import { versionOneWhyChainSchema, whyChainFormOf } from "../src/infrastructure/discipline-exceptions-folder/version-one-why-chain.ts";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "./version-one-causal-why-chain.ts";

describe("VERSION_ONE_CAUSAL_WHY_CHAIN is a chain the version 1 causal contract accepts", () => {
  it("reads as causal", () => {
    expect(whyChainFormOf({ chain: VERSION_ONE_CAUSAL_WHY_CHAIN })).toBe("causal");
  });

  it("passes the version 1 schema unchanged", () => {
    expect(versionOneWhyChainSchema.safeParse(VERSION_ONE_CAUSAL_WHY_CHAIN)).toEqual({ success: true, data: VERSION_ONE_CAUSAL_WHY_CHAIN });
  });

  it("raises no causal problem", () => {
    expect(causalProblemsOf({ chain: VERSION_ONE_CAUSAL_WHY_CHAIN })).toEqual([]);
  });
});
