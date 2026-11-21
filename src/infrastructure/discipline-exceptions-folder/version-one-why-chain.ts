import { z } from "zod";
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
} from "../hone-records-folder/why-chain.ts";

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

const ROOT_CHECK_REQUIRED =
  "`whyChain.rootCheck` is required beside `readback` in a causal chain: name what was run or read today that shows the root still holds, with a path, record, measurement or link";
const ROOT_CHECK_UNLOCATED =
  "`whyChain.rootCheck` cites nothing checkable: name the path, record, measurement or link you checked today";
const READBACK_REQUIRED =
  "`whyChain.readback` is required beside `rootCheck` in a causal chain: read from the root back to the symptom with \"therefore\"";

export const legacyWhyChainSchema: z.ZodType<LegacyWhyChain> = z.object(
  {
    whys: fiveWhysSchema({ why: legacyWhySchema }),
    rootCause: rootCauseSchema,
    owner: ownerSchema,
  },
  { error: "`whyChain` is not a JSON object" },
);

export const versionOneWhyChainSchema: z.ZodType<VersionOneWhyChain> = z
  .object(
    {
      whys: fiveWhysSchema({ why: causalWhySchema }),
      rootCause: rootCauseSchema,
      rootCheck: checkableTextSchema({ missing: ROOT_CHECK_REQUIRED, unlocated: ROOT_CHECK_UNLOCATED }),
      readback: substantiveTextSchema({ refusal: READBACK_REQUIRED }),
      owner: ownerSchema,
    },
    { error: "`whyChain` is not a JSON object" },
  )
  .superRefine((chain, context) => {
    causalProblemsOf({ chain }).forEach((problem) => {
      context.addIssue({ code: "custom", path: [...problem.path], message: problem.message });
    });
  });

export const whyChainFormOf = (request: { readonly chain: unknown }): WhyChainForm =>
  typeof request.chain === "object" &&
  request.chain !== null &&
  !Array.isArray(request.chain) &&
  !("rootCheck" in request.chain) &&
  !("readback" in request.chain)
    ? "legacy"
    : "causal";
