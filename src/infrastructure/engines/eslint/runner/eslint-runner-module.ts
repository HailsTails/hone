import type { NamedEslintRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import type { Result } from "../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { NativeException } from "../../../../domain/runner/runner-result-types.ts";
import type { RunnerFileScope } from "../../protocol/checks/checks-runner-module-schema.ts";
import type { NamedChecksRunner } from "../../protocol/checks/checks-runner-types.ts";
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

export type EslintRunnerModule = {
  readonly namedChecksRunner: NamedChecksRunner<NamedEslintRunRequest> & {
    readonly fileScope: RunnerFileScope;
    readonly projectedKinds: readonly NativeException["kind"][];
  };
  readonly measureVersionOne: EslintChecksRunner["measureVersionOne"];
  readonly versionOneProjectionOver: typeof versionOneProjectionOver;
};

export const eslintRunnerModuleOver = (request: {
  readonly toolchain: Promise<Result<EslintToolchain, RunnerFailure>>;
  readonly platform: Omit<EslintPlatformPorts, "eslint">;
}): EslintRunnerModule => ({
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
