import type { Result } from "../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { EslintPlatformPorts } from "./checks-runner/checks-ports.ts";
import {
  bindEslintChecksModule,
  createChecksRunner,
  type EslintChecksRunner,
} from "./checks-runner/checks-runner.ts";
import {
  ESLINT_PROJECTED_KINDS,
  versionOneProjectionOver,
} from "./embedded-runner/create-eslint-runner.ts";
import { createEslintPort, type EslintToolchain } from "./toolchain/eslint-instance.ts";

export const eslintRunnerModuleOver = (request: {
  readonly toolchain: Promise<Result<EslintToolchain, RunnerFailure>>;
  readonly platform: Omit<EslintPlatformPorts, "eslint">;
}) => ({
  ...bindEslintChecksModule({
    runner: request.toolchain.then((loaded): Result<EslintChecksRunner, RunnerFailure> =>
      loaded.outcome === "failed"
        ? loaded
        : {
            outcome: "ok",
            value: createChecksRunner({
              ...request.platform,
              eslint: createEslintPort({ toolchain: loaded.value }),
            }),
          },
    ),
    projectedKinds: ESLINT_PROJECTED_KINDS,
  }),
  versionOneProjectionOver,
});
