import { z } from "zod";
import { type Why, type WhyChain, causalProblemsOf } from "../../domain/records/why-chain.ts";

const RESTATEMENT_PHRASES = [
  String.raw`(?:the\s+)?(?:gate|check|ci|build|lint|test)s?\s+(?:was|were|is|are)\s+(?:failing|red|broken)`,
  String.raw`(?:there\s+was\s+)?no\s+time`,
  String.raw`we\s+(?:had\s+no|ran\s+out\s+of)\s+time`,
  String.raw`(?:it\s+(?:is|was)\s+)?out\s+of\s+scope`,
  String.raw`(?:it\s+(?:is|was)\s+)?(?:the\s+|an?\s+)?existing\s+(?:code|convention|pattern)`,
  String.raw`(?:a\s+|the\s+)?time\s+constraint`,
  String.raw`(?:a\s+|the\s+)?deadline`,
];

const RESTATEMENT_OPENING = new RegExp(
  String.raw`^(?:because\s+(?:of\s+)?)?(?:${RESTATEMENT_PHRASES.join("|")})\b`,
  "i",
);

const MINIMUM_ANSWER_CHARACTERS = 12;
const MINIMUM_OWNER_CHARACTERS = 2;
const ONE_REPEATED_CHARACTER = /^(.)\1+$/;
const PROSE_LOOKALIKES = /\b(?:e\.g\b\.?|i\.e\b\.?|a\.k\.a\.|etc\.|[ap]\.m\.)|(?<![\w./\\-])(?:and\/or|n\/a|w\/o|yes\/no)(?![\w./\\-])/gi;
const CHECKABLE_LOCATORS: readonly RegExp[] = [
  /https?:\/\/\S/i,
  /[\w.-][\\/][\w.-]/,
  /(?:^|[\s(\x60'"])(?:\*|[\w-]+)(?:\.[\w-]+)*\.[a-z][a-z0-9]{0,9}\b/,
  /(?:^|[\s(\x60'"])\.[a-z][\w-]+\b/,
  /\d/,
];

const rootCauseReading = (request: {
  readonly rootCause: string;
}): "restates-the-exception" | "names-a-cause" =>
  RESTATEMENT_OPENING.test(request.rootCause.trim())
    ? "restates-the-exception"
    : "names-a-cause";

const answerSubstance = (request: {
  readonly answer: string;
}): "substantive" | "placeholder" =>
  request.answer.trim().length >= MINIMUM_ANSWER_CHARACTERS &&
  !ONE_REPEATED_CHARACTER.test(request.answer.trim())
    ? "substantive"
    : "placeholder";

const evidenceReading = (request: { readonly evidence: string }): "checkable" | "unlocated" =>
  CHECKABLE_LOCATORS.some((locator) => locator.test(request.evidence.replace(PROSE_LOOKALIKES, " ")))
    ? "checkable"
    : "unlocated";

export const substantiveTextSchema = (request: { readonly refusal: string }) =>
  z
    .string({ error: request.refusal })
    .refine((answer) => answerSubstance({ answer }) === "substantive", {
      error: request.refusal,
    });

export const checkableTextSchema = (request: { readonly missing: string; readonly unlocated: string }) =>
  substantiveTextSchema({ refusal: request.missing }).refine((evidence) => evidenceReading({ evidence }) === "checkable", {
    error: request.unlocated,
  });

const WHY_QUESTION_MISSING = "is missing its `why` question";
const BECAUSE_MISSING = "carries no real `because` answer: a placeholder is an absent answer";
const EVIDENCE_MISSING = "carries no real `evidence`: cite a command, path, record id, PR, or named ruling";
const EVIDENCE_UNLOCATED =
  "carries no checkable `evidence`: cite a path, a line, a record or PR number, a measurement or a link";
const ROOT_CAUSE_REQUIRED =
  "`whyChain.rootCause` is required: the fifth why names the cause, not another symptom";
const ROOT_EVIDENCE_REQUIRED =
  "`whyChain.rootEvidence` is required beside `readback` in a causal chain: name what was run or read today that shows the root still holds, with a path, record, measurement or link";
const ROOT_EVIDENCE_UNLOCATED =
  "`whyChain.rootEvidence` cites nothing checkable: name the path, record, measurement or link you checked today";
const READBACK_REQUIRED =
  "`whyChain.readback` is required beside `rootEvidence` in a causal chain: read from the root back to the symptom with \"therefore\"";
const OWNER_REQUIRED =
  "`whyChain.owner` is required: a record dir, a capture id, or the holder of the reserved authority";

const whyQuestionSchema = z
  .string({ error: WHY_QUESTION_MISSING })
  .refine((question) => question.trim().length > 0, {
    error: WHY_QUESTION_MISSING,
  });

export const legacyWhySchema = z.object(
  {
    why: whyQuestionSchema,
    because: substantiveTextSchema({ refusal: BECAUSE_MISSING }),
    evidence: substantiveTextSchema({ refusal: EVIDENCE_MISSING }),
  },
  { error: "is not a JSON object" },
);

export const causalWhySchema = z.object(
  {
    why: whyQuestionSchema,
    because: substantiveTextSchema({ refusal: BECAUSE_MISSING }),
    evidence: checkableTextSchema({ missing: EVIDENCE_MISSING, unlocated: EVIDENCE_UNLOCATED }),
  },
  { error: "is not a JSON object" },
);

export const fiveWhysSchema = (request: { readonly why: z.ZodType<Why> }) =>
  z.tuple([request.why, request.why, request.why, request.why, request.why], {
    error: "`whyChain.whys` must hold exactly 5 whys",
  });

export const rootCauseSchema = z
  .string({ error: ROOT_CAUSE_REQUIRED })
  .refine((answer) => answerSubstance({ answer }) === "substantive", {
    error: ROOT_CAUSE_REQUIRED,
    abort: true,
  })
  .refine((rootCause) => rootCauseReading({ rootCause }) === "names-a-cause", {
    error: "`whyChain.rootCause` restates the exception rather than naming its cause",
  });

export const ownerSchema = z
  .string({ error: OWNER_REQUIRED })
  .refine((owner) => owner.trim().length >= MINIMUM_OWNER_CHARACTERS, {
    error: OWNER_REQUIRED,
  });

const WHY_CHAIN_NOT_AN_OBJECT = "`whyChain` is not a JSON object";

const unknownFieldRefusal = (key: string): string =>
  key === "rootCheck" ? "`whyChain.rootCheck` is `whyChain.rootEvidence` in version 2" : `\`whyChain.${key}\` is not a field of a why chain`;

export const whyChainSchema: z.ZodType<WhyChain> = z
  .strictObject(
    {
      whys: fiveWhysSchema({ why: causalWhySchema }),
      rootCause: rootCauseSchema,
      rootEvidence: checkableTextSchema({ missing: ROOT_EVIDENCE_REQUIRED, unlocated: ROOT_EVIDENCE_UNLOCATED }),
      readback: substantiveTextSchema({ refusal: READBACK_REQUIRED }),
      owner: ownerSchema,
    },
    { error: (issue) => (issue.code === "unrecognized_keys" ? issue.keys.map(unknownFieldRefusal).join("; ") : WHY_CHAIN_NOT_AN_OBJECT) },
  )
  .superRefine((chain, context) => {
    causalProblemsOf({ chain }).forEach((problem) => {
      context.addIssue({ code: "custom", path: [...problem.path], message: problem.message });
    });
  });
