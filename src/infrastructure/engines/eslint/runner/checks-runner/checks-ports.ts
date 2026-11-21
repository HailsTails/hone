import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { FileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import type { PathPort } from "../../../../node/path-port.ts";
import type { AbsolutePath } from "../../../../content-files/absolute-path.ts";
import type { ModuleExtension } from "../../../../node/modules/install-layout.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ChecksRepository } from "./checks-repository.ts";
import type { CoreInstall } from "../projection/core-install.ts";
import type { EslintPort } from "../toolchain/eslint-instance.ts";
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
  readonly coreInstall: (request: { readonly installRoot: AbsolutePath }) => Result<CoreInstall, RunnerFailure>;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly eslint: EslintPort;
};
