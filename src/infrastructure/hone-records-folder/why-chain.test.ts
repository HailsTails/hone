import { describe, expect, it } from "vitest";
import { CAUSAL_WHY_CHAIN } from "../../../tests/causal-why-chain.ts";
import {
  causalProblemsOf,
  causalWhySchema,
  checkableTextSchema,
  fiveWhysSchema,
  legacyWhySchema,
  ownerSchema,
  rootCauseSchema,
  substantiveTextSchema,
  type WhyChain,
  whyChainSchema,
} from "./why-chain.ts";

const ROOT_EVIDENCE_REQUIRED =
  "`whyChain.rootEvidence` is required beside `readback` in a causal chain: name what was run or read today that shows the root still holds, with a path, record, measurement or link";

const ROOT_EVIDENCE_UNLOCATED =
  "`whyChain.rootEvidence` cites nothing checkable: name the path, record, measurement or link you checked today";

const ROOT_CHECK_RENAMED = "`whyChain.rootCheck` is `whyChain.rootEvidence` in version 2";

const READBACK_REQUIRED =
  "`whyChain.readback` is required beside `rootEvidence` in a causal chain: read from the root back to the symptom with \"therefore\"";

const withoutRootEvidence: Omit<WhyChain, "rootEvidence"> = {
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

const withoutReadback: Omit<WhyChain, "readback"> = {
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootEvidence: CAUSAL_WHY_CHAIN.rootEvidence,
  owner: CAUSAL_WHY_CHAIN.owner,
};

const versionOneNamed = {
  whys: CAUSAL_WHY_CHAIN.whys,
  rootCause: CAUSAL_WHY_CHAIN.rootCause,
  rootCheck: CAUSAL_WHY_CHAIN.rootEvidence,
  readback: CAUSAL_WHY_CHAIN.readback,
  owner: CAUSAL_WHY_CHAIN.owner,
};

describe("whyChainSchema names the version 2 field rootEvidence in what it refuses", () => {
  it("asks for rootEvidence by name when it is missing", () => {
    expect(whyChainSchema.safeParse(withoutRootEvidence)).toMatchObject({
      success: false,
      error: { issues: [{ path: ["rootEvidence"], message: ROOT_EVIDENCE_REQUIRED }] },
    });
  });

  it("asks for something checkable when rootEvidence cites nothing", () => {
    expect(whyChainSchema.safeParse({ ...CAUSAL_WHY_CHAIN, rootEvidence: "the monorepo move is still incomplete today" })).toMatchObject({
      success: false,
      error: { issues: [{ path: ["rootEvidence"], message: ROOT_EVIDENCE_UNLOCATED }] },
    });
  });

  it("asks for the readback beside rootEvidence by name when it is missing", () => {
    expect(whyChainSchema.safeParse(withoutReadback)).toMatchObject({
      success: false,
      error: { issues: [{ path: ["readback"], message: READBACK_REQUIRED }] },
    });
  });
});

describe("whyChainSchema does not read the version 1 name rootCheck", () => {
  it("refuses a chain that states its evidence as rootCheck, naming rootCheck as unrecognised and asking for rootEvidence", () => {
    expect(whyChainSchema.safeParse(versionOneNamed)).toMatchObject({
      success: false,
      error: { issues: [{ path: ["rootEvidence"], message: ROOT_EVIDENCE_REQUIRED }, { path: [], message: ROOT_CHECK_RENAMED }] },
    });
  });

  it("refuses a chain that holds rootCheck beside rootEvidence, naming rootCheck as unrecognised", () => {
    expect(whyChainSchema.safeParse({ ...CAUSAL_WHY_CHAIN, rootCheck: CAUSAL_WHY_CHAIN.rootEvidence })).toMatchObject({
      success: false,
      error: { issues: [{ path: [], message: ROOT_CHECK_RENAMED }] },
    });
  });

  it("refuses a chain that holds a key it does not know, naming the key", () => {
    expect(whyChainSchema.safeParse({ ...CAUSAL_WHY_CHAIN, remark: "x" })).toMatchObject({
      success: false,
      error: { issues: [{ path: [], message: "`whyChain.remark` is not a field of a why chain" }] },
    });
  });

  it("parses to a chain that holds no rootCheck", () => {
    expect(whyChainSchema.parse(CAUSAL_WHY_CHAIN)).not.toHaveProperty("rootCheck");
  });
});

describe("causalProblemsOf reads only the parts of a chain the causal contract judges", () => {
  it("raises no problem for whys, a root cause and a readback alone", () => {
    expect(
      causalProblemsOf({ chain: { whys: CAUSAL_WHY_CHAIN.whys, rootCause: CAUSAL_WHY_CHAIN.rootCause, readback: CAUSAL_WHY_CHAIN.readback } }),
    ).toEqual([]);
  });
});

describe("the building blocks the version 1 reading shares", () => {
  const WHY = CAUSAL_WHY_CHAIN.whys[0];

  it("substantiveTextSchema refuses a placeholder with the refusal it is given", () => {
    expect(substantiveTextSchema({ refusal: "say more" }).safeParse("tbd")).toMatchObject({ success: false, error: { issues: [{ message: "say more" }] } });
  });

  it("checkableTextSchema refuses text that cites nothing checkable with the unlocated refusal", () => {
    expect(checkableTextSchema({ missing: "say more", unlocated: "cite it" }).safeParse("a long enough sentence")).toMatchObject({
      success: false,
      error: { issues: [{ message: "cite it" }] },
    });
  });

  it("legacyWhySchema accepts evidence that cites nothing checkable", () => {
    expect(legacyWhySchema.safeParse({ ...WHY, evidence: "a long enough sentence" }).success).toBe(true);
  });

  it("causalWhySchema refuses evidence that cites nothing checkable", () => {
    expect(causalWhySchema.safeParse({ ...WHY, evidence: "a long enough sentence" }).success).toBe(false);
  });

  it("fiveWhysSchema refuses anything but five whys", () => {
    expect(fiveWhysSchema({ why: causalWhySchema }).safeParse([WHY, WHY, WHY, WHY])).toMatchObject({
      success: false,
      error: { issues: [{ message: "`whyChain.whys` must hold exactly 5 whys" }] },
    });
  });

  it("rootCauseSchema refuses a root cause that restates the exception", () => {
    expect(rootCauseSchema.safeParse("there was no time to pay it down").success).toBe(false);
  });

  it("ownerSchema refuses an owner of one character", () => {
    expect(ownerSchema.safeParse("H").success).toBe(false);
  });
});
