import { z } from "zod";

import type { LoadedRunner } from "../../../application/ports/engine/runner-module.ts";
import type { Result } from "../../../domain/result.ts";
import type { SourceCase } from "../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../domain/runner/check-binding.ts";
import type {
  CaseMismatch,
  CheckConformanceFailure,
  ConformanceFailure,
} from "../../../domain/runner/conformance-types.ts";
import {
  type RunnerFailure,
  rejectedCall,
  runnerInvalidOutput,
} from "../../../domain/runner/runner-failure.ts";
import type { RunnerClause } from "../../../domain/runner/runner-module-types.ts";
import type { CaseVerdict } from "../../../domain/runner/runner-result-types.ts";
import { caseVerdictSchema, runnerResultSchema } from "./runner-module/runner-result-schema.ts";

const caseVerdictsResultSchema = runnerResultSchema({
  value: z.array(caseVerdictSchema).readonly(),
});

const lineSet = (request: { readonly lines: readonly number[] }): readonly number[] =>
  [...new Set(request.lines)].toSorted((left, right) => left - right);

const verdictsNaming = (request: {
  readonly verdicts: readonly CaseVerdict[];
  readonly caseName: string;
}): readonly CaseVerdict[] =>
  request.verdicts.filter((verdict) => verdict.caseName === request.caseName);

const unmatchedVerdict = (request: {
  readonly verdicts: readonly CaseVerdict[];
  readonly cases: readonly SourceCase[];
}): string | undefined => {
  const missing = request.cases.find(
    (sourceCase) =>
      verdictsNaming({ verdicts: request.verdicts, caseName: sourceCase.name }).length !== 1,
  );
  if (missing !== undefined) {
    return `case ${missing.name} has no single verdict`;
  }
  const unknown = request.verdicts.find(
    (verdict) => !request.cases.some((sourceCase) => sourceCase.name === verdict.caseName),
  );
  return unknown === undefined ? undefined : `a verdict names the unknown case ${unknown.caseName}`;
};

const caseConformance = (request: {
  readonly sourceCase: SourceCase;
  readonly verdicts: readonly CaseVerdict[];
}): readonly CaseMismatch[] => {
  const { sourceCase } = request;
  const expectedLines = lineSet({ lines: sourceCase.expectedLines });
  const flaggedLines = lineSet({
    lines: verdictsNaming({ verdicts: request.verdicts, caseName: sourceCase.name }).flatMap(
      (verdict) => verdict.flaggedLines,
    ),
  });
  if (expectedLines.join(" ") === flaggedLines.join(" ")) {
    return [];
  }
  return [{ caseName: sourceCase.name, expectedLines, flaggedLines }];
};

const conformanceOf = (request: {
  readonly returned: unknown;
  readonly cases: readonly SourceCase[];
}): Result<readonly CaseMismatch[], RunnerFailure> => {
  const parsed = caseVerdictsResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const verdicts = parsed.data.value;
  const unmatched = unmatchedVerdict({ verdicts, cases: request.cases });
  if (unmatched !== undefined) {
    return runnerInvalidOutput({ detail: unmatched });
  }
  return {
    outcome: "ok",
    value: request.cases.flatMap((sourceCase) => caseConformance({ sourceCase, verdicts })),
  };
};

const compareCases = async (request: {
  readonly act: () => Promise<unknown>;
  readonly cases: readonly SourceCase[];
}): Promise<Result<readonly CaseMismatch[], RunnerFailure>> =>
  Promise.resolve()
    .then(request.act)
    .then(
      (returned) => conformanceOf({ returned, cases: request.cases }),
      (thrown: unknown) => rejectedCall({ thrown }),
    );

export const checkConformance = async (request: {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly runner: Pick<LoadedRunner, "conform">;
}): Promise<Result<readonly ConformanceFailure[], RunnerFailure>> => {
  const compared = await compareCases({
    ...request,
    act: () => request.runner.conform({ clause: request.clause, cases: request.cases }),
  });
  return compared.outcome === "failed"
    ? compared
    : {
        outcome: "ok",
        value: compared.value.map((failure) => ({ ...failure, clause: request.clause.address })),
      };
};

export const namedCheckConformance = async (request: {
  readonly binding: CheckBinding;
  readonly cases: readonly SourceCase[];
  readonly runner: {
    readonly conform: (request: {
      readonly binding: CheckBinding;
      readonly cases: readonly SourceCase[];
    }) => Promise<unknown>;
  };
}): Promise<Result<readonly CheckConformanceFailure[], RunnerFailure>> => {
  const compared = await compareCases({
    ...request,
    act: () => request.runner.conform({ binding: request.binding, cases: request.cases }),
  });
  return compared.outcome === "failed"
    ? compared
    : {
        outcome: "ok",
        value: compared.value.map((failure) => ({ ...failure, check: request.binding.address })),
      };
};
