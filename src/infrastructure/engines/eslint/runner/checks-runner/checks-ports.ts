import type { FileRemovalPort } from "../../../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleExtension } from "../../../../../application/ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { CoreInstall } from "../projection/core-install.ts";
import type { EslintPort } from "../toolchain/eslint-instance.ts";
import type { ChecksRepository } from "./checks-repository.ts";
export type EslintPlatformPorts = {
  readonly fileText: FileTextPort;
  readonly fileRemoval: FileRemovalPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
  readonly moduleExtension: ModuleExtension;
};

export type ChecksRunnerPorts = {
  readonly repositoryAt: (request: { readonly repoRoot: AbsolutePath }) => ChecksRepository;
  readonly coreInstall: (request: {
    readonly installRoot: AbsolutePath;
  }) => Result<CoreInstall, RunnerFailure>;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
};
