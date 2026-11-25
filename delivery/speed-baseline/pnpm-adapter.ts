import type { PathPort } from "../../src/application/ports/host/path-port.ts";
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
import type { EnvironmentVariablePort } from "./environment-variable-port.ts";
import type { HoneDependenciesPort } from "./hone-dependencies-port.ts";
import type { HonePackagePort } from "./hone-package-port.ts";
import type { TargetInstallPort } from "./target-install-port.ts";

const PACKED_TARBALL_LINE = /^pack package: wrote (.+)$/m;

const PNPM_SCRIPT_VARIABLE = "npm_execpath";

const UNNAMED_PNPM: CommandFailure = {
  kind: "unlaunched",
  detail: `${PNPM_SCRIPT_VARIABLE} names no pnpm: run this through corepack pnpm run`,
};

export const PNPM_POLICY: ExecutionPolicy<"captured", "none"> = {
  executable: "node",
  environment: ({ ambient }) => createEnvironmentOutsideRepository({ ambientEnvironment: ambient }),
  timeoutMilliseconds: undefined,
  maximumOutputBytes: 64 * 1024 * 1024,
  stdout: "captured",
  replyPipe: "none",
};

type PnpmPorts = {
  readonly node: ExecutionPort<"captured", "none">;
  readonly environment: EnvironmentVariablePort;
};

const runPnpm = (request: {
  readonly ports: PnpmPorts;
  readonly arguments: readonly string[];
  readonly cwd: AbsolutePath;
}): Result<ExecutionExit<"captured", "none">, CommandFailure> => {
  const script = request.ports.environment.read({ name: PNPM_SCRIPT_VARIABLE });
  return script === undefined
    ? { outcome: "failed", error: UNNAMED_PNPM }
    : mapExecutionToCommandResult({
        run: request.ports.node.run({
          arguments: [script, ...request.arguments],
          cwd: request.cwd,
        }),
      });
};

export const createHoneDependenciesPort = (options: PnpmPorts): HoneDependenciesPort => ({
  write: (request) => {
    const installed = runPnpm({
      ports: options,
      arguments: ["install", "--frozen-lockfile"],
      cwd: request.honeRoot,
    });
    return installed.outcome === "failed"
      ? {
          outcome: "failed",
          error: { kind: "hone-dependencies-uninstalled", command: installed.error },
        }
      : { outcome: "ok", value: null };
  },
});

export const createHonePackagePort = (
  options: PnpmPorts & { readonly path: PathPort },
): HonePackagePort => ({
  write: (request) => {
    const packed = runPnpm({
      ports: options,
      arguments: ["run", "pack-package"],
      cwd: request.honeRoot,
    });
    if (packed.outcome === "failed") {
      return { outcome: "failed", error: { kind: "hone-unpacked", command: packed.error } };
    }
    const output = `${packed.value.stdout}${packed.value.stderr}`;
    const tarball = PACKED_TARBALL_LINE.exec(output)?.[1]?.trim();
    if (tarball === undefined)
      return { outcome: "failed", error: { kind: "tarball-unnamed", output } };
    const resolved = options.path.resolve({ path: tarball });
    return resolved.outcome === "failed"
      ? { outcome: "failed", error: { kind: "tarball-unresolved", path: tarball } }
      : resolved;
  },
});

export const createPnpmTargetInstallPort = (options: PnpmPorts): TargetInstallPort => ({
  write: (request) => {
    const dependencies = runPnpm({
      ports: options,
      arguments: ["install", "--frozen-lockfile", "--prefer-offline"],
      cwd: request.directory,
    });
    const installed =
      dependencies.outcome === "failed"
        ? dependencies
        : runPnpm({
            ports: options,
            arguments: ["add", "--save-dev", "--prefer-offline", request.tarball],
            cwd: request.directory,
          });
    return installed.outcome === "failed"
      ? { outcome: "failed", error: { kind: "hone-uninstalled", command: installed.error } }
      : { outcome: "ok", value: null };
  },
});
