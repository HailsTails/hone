import { z } from "zod";
import { causalWhySchema, checkableTextSchema, fiveWhysSchema, legacyWhySchema, ownerSchema, rootCauseSchema, substantiveTextSchema } from "../hone-records-folder/why-chain.ts";
import { causalProblemsOf } from "../../domain/records/why-chain.ts";
import type { LegacyWhyChain, VersionOneWhyChain } from "../../domain/records/discipline-exceptions/version-one-why-chain.ts";

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
