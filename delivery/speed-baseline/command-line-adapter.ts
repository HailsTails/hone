import { z } from "zod";

import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import type { Result } from "../../src/domain/result.ts";
import { argumentProblemText } from "../../src/infrastructure/command-line/arguments/argument-problem.ts";
import { REPO_OPTION } from "../../src/infrastructure/command-line/arguments/command-line.ts";
import { repoArgumentOf } from "../../src/infrastructure/command-line/arguments/repo-argument.ts";
import type {
  SpeedBaselineArguments,
  SpeedBaselineArgumentsPort,
  SpeedBaselineUsageRefusal,
} from "./speed-baseline-arguments-port.ts";

const CALIBRATE_FLAG = "--calibrate";

const SPEED_BASELINE_USAGE = `usage: corepack pnpm run speed-baseline ${REPO_OPTION.name} ${REPO_OPTION.value} [${CALIBRATE_FLAG}]\n`;

const speedBaselineOptionsSchema = z.object({
  repo: z.string().min(1),
  calibrate: z.boolean(),
  unexpected: z.array(z.string()).max(0),
});

const createUsageRefusal = (request: { readonly detail: string }): SpeedBaselineUsageRefusal => ({
  kind: "usage-refused",
  detail: request.detail,
  usage: SPEED_BASELINE_USAGE,
});

const JOINED_REPO_PREFIX = `${REPO_OPTION.name}=`;

const mapArgumentsToJoinedRepoRefusal = (request: {
  readonly arguments: readonly string[];
}): SpeedBaselineUsageRefusal | undefined => {
  const given = request.arguments.find((argument) => argument.startsWith(JOINED_REPO_PREFIX));
  return given === undefined
    ? undefined
    : createUsageRefusal({
        detail: argumentProblemText({
          problem: { kind: "option-joined", option: REPO_OPTION, given },
        }),
      });
};

const mapArgumentsToGivenOptions = (request: {
  readonly arguments: readonly string[];
}): unknown => ({
  repo: repoArgumentOf(request),
  calibrate: request.arguments.includes(CALIBRATE_FLAG),
  unexpected: request.arguments.filter(
    (argument, position) =>
      argument !== CALIBRATE_FLAG &&
      argument !== REPO_OPTION.name &&
      request.arguments[position - 1] !== REPO_OPTION.name,
  ),
});

export const createCommandLineArgumentsPort = (options: {
  readonly arguments: readonly string[];
  readonly path: PathPort;
}): SpeedBaselineArgumentsPort => ({
  read: (): Result<SpeedBaselineArguments, SpeedBaselineUsageRefusal> => {
    const joined = mapArgumentsToJoinedRepoRefusal(options);
    if (joined !== undefined) return { outcome: "failed", error: joined };
    const parsed = speedBaselineOptionsSchema.safeParse(mapArgumentsToGivenOptions(options));
    if (!parsed.success) {
      return {
        outcome: "failed",
        error: createUsageRefusal({ detail: z.prettifyError(parsed.error) }),
      };
    }
    const repo = options.path.resolve({ path: parsed.data.repo });
    return repo.outcome === "failed"
      ? {
          outcome: "failed",
          error: createUsageRefusal({ detail: `${parsed.data.repo} cannot be resolved` }),
        }
      : {
          outcome: "ok",
          value: { repo: repo.value, mode: parsed.data.calibrate ? "calibrate" : "compare" },
        };
  },
});
