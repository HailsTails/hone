import { type Stems, stemsOf, stemsShared, stemsWithout, wordsOf } from "./chain-stems.ts";

export type Why = {
  readonly why: string;
  readonly because: string;
  readonly evidence: string;
};

type FiveWhys = readonly [Why, Why, Why, Why, Why];

export type WhyChain = {
  readonly whys: FiveWhys;
  readonly rootCause: string;
  readonly rootEvidence: string;
  readonly readback: string;
  readonly owner: string;
};

const MINIMUM_SYMPTOM_STEMS_NAMED = 2;
const MINIMUM_NEW_STEM_SHARE = 0.25;
const THEREFORE = /\btherefore\b/i;

export type CausalProblem = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

const causeNamed = (request: { readonly cause: Stems }): string =>
  wordsOf({ stems: request.cause }).join(", ");

const symptomProblems = (request: { readonly symptom: Stems }): readonly CausalProblem[] =>
  request.symptom.size === 0
    ? [
        {
          path: ["whys", 0, "why"],
          message: "names no symptom: ask why the exception's own subject happens, naming it",
        },
      ]
    : [];

const restatementProblems = (request: {
  readonly answers: readonly Stems[];
  readonly introduced: readonly Stems[];
}): readonly CausalProblem[] =>
  request.introduced.flatMap((cause, position) =>
    cause.size === 0 || cause.size < MINIMUM_NEW_STEM_SHARE * (request.answers[position]?.size ?? 0)
      ? [
          {
            path: ["whys", position, "because"],
            message: `restates ${position === 0 ? "the symptom" : "the symptom or an earlier answer"}: give the cause behind it, with at least a quarter of its words new to the chain`,
          },
        ]
      : [],
  );

const linkProblems = (request: {
  readonly whys: FiveWhys;
  readonly introduced: readonly Stems[];
}): readonly CausalProblem[] =>
  request.introduced.slice(0, -1).flatMap((cause, position) =>
    cause.size > 0 &&
    stemsShared({ left: cause, right: stemsOf({ text: request.whys[position + 1]?.why ?? "" }) })
      .size === 0
      ? [
          {
            path: ["whys", position + 1, "why"],
            message: `does not ask about the cause why ${position + 1}'s answer gave: ask why that answer is true, naming its cause (${causeNamed({ cause })})`,
          },
        ]
      : [],
  );

const rootProblems = (request: {
  readonly rootCause: string;
  readonly fifthCause: Stems;
}): readonly CausalProblem[] =>
  request.fifthCause.size > 0 &&
  stemsShared({ left: request.fifthCause, right: stemsOf({ text: request.rootCause }) }).size === 0
    ? [
        {
          path: ["rootCause"],
          message: `\`whyChain.rootCause\` does not name the cause why 5's answer gave: the root is the cause behind that answer (${causeNamed({ cause: request.fifthCause })})`,
        },
      ]
    : [];

const readbackProblems = (request: {
  readonly readback: string;
  readonly rootCause: string;
  readonly symptom: Stems;
}): readonly CausalProblem[] => {
  const readback = stemsOf({ text: request.readback });
  const root = stemsOf({ text: request.rootCause });
  const symptomNamed = stemsShared({ left: request.symptom, right: readback }).size;
  return [
    ...(THEREFORE.test(request.readback)
      ? []
      : ['`whyChain.readback` must read from the root back to the symptom with "therefore"']),
    ...(root.size > 0 && stemsShared({ left: root, right: readback }).size === 0
      ? [`\`whyChain.readback\` must name the root it starts from (${causeNamed({ cause: root })})`]
      : []),
    ...(symptomNamed < Math.min(MINIMUM_SYMPTOM_STEMS_NAMED, request.symptom.size)
      ? [
          `\`whyChain.readback\` must name the symptom why 1 asks about (${causeNamed({ cause: request.symptom })})`,
        ]
      : []),
  ].map((message) => ({ path: ["readback"], message }));
};

export const causalProblemsOf = (request: {
  readonly chain: Pick<WhyChain, "whys" | "rootCause" | "readback">;
}): readonly CausalProblem[] => {
  const { whys, rootCause, readback } = request.chain;
  const symptom = stemsOf({ text: whys[0].why });
  const answers = whys.map((step) => stemsOf({ text: step.because }));
  const introduced = answers.map((answer, position) =>
    stemsWithout({ stems: answer, excluded: [symptom, ...answers.slice(0, position)] }),
  );
  return [
    ...symptomProblems({ symptom }),
    ...restatementProblems({ answers, introduced }),
    ...linkProblems({ whys, introduced }),
    ...rootProblems({ rootCause, fifthCause: introduced[4] ?? new Map() }),
    ...readbackProblems({ readback, rootCause, symptom }),
  ];
};
