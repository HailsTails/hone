import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import { createEnvironmentOutsideRepository } from "../../src/infrastructure/git/git-port.ts";
import type {
  ExecutionExit,
  ExecutionPolicy,
  ExecutionPort,
} from "../../src/infrastructure/node/process/execution-port.ts";
import type { CommandFailure } from "./command-failure.ts";
import { mapExecutionToCommandResult } from "./command-result.ts";
import type { TargetInstallPort } from "./target-install-port.ts";

export const BUN_POLICY: ExecutionPolicy<"captured", "none"> = {
  executable: "bun",
  environment: ({ ambient }) => createEnvironmentOutsideRepository({ ambientEnvironment: ambient }),
  timeoutMilliseconds: undefined,
  maximumOutputBytes: 64 * 1024 * 1024,
  stdout: "captured",
  replyPipe: "none",
};

const runBun = (request: {
  readonly bun: ExecutionPort<"captured", "none">;
  readonly arguments: readonly string[];
  readonly cwd: AbsolutePath;
}): Result<ExecutionExit<"captured", "none">, CommandFailure> =>
  mapExecutionToCommandResult({
    run: request.bun.run({ arguments: request.arguments, cwd: request.cwd }),
  });

export const createBunTargetInstallPort = (options: {
  readonly bun: ExecutionPort<"captured", "none">;
}): TargetInstallPort => ({
  write: (request) => {
    const dependencies = runBun({
      bun: options.bun,
      arguments: ["install", "--frozen-lockfile", "--prefer-offline"],
      cwd: request.directory,
    });
    const installed =
      dependencies.outcome === "failed"
        ? dependencies
        : runBun({
            bun: options.bun,
            arguments: ["add", "--dev", "--prefer-offline", request.tarball],
            cwd: request.directory,
          });
    return installed.outcome === "failed"
      ? { outcome: "failed", error: { kind: "hone-uninstalled", command: installed.error } }
      : { outcome: "ok", value: null };
  },
});
