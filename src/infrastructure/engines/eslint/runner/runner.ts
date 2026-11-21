import { toolchainBoundChecksRunner, toolchainBoundEmbeddedRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultFileRemovalPort } from "../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { installFormOf } from "../../../node/modules/install-layout.ts";
import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import { createChecksRunner } from "./checks-runner/checks-runner.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "./embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "./toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "./toolchain/eslint-toolchain.ts";

export const runner = toolchainBoundEmbeddedRunner({
  toolchain: loadEslintToolchain({
    peers: defaultEslintToolchainPeers({
      installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
      installForm: installFormOf({ moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }) }),
    }),
  }),
  projectedKinds: ESLINT_PROJECTED_KINDS,
  runnerOf: (toolchain) =>
    createEslintRunner({
      fileText: createDefaultFileTextPort({}),
      fileRemoval: createDefaultFileRemovalPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      eslint: createEslintPort({ toolchain }),
      moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
    }),
});

export const checksRunner = toolchainBoundChecksRunner({
  toolchain: loadEslintToolchain({
    peers: defaultEslintToolchainPeers({
      installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
      installForm: installFormOf({ moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }) }),
    }),
  }),
  projectedKinds: ESLINT_PROJECTED_KINDS,
  runnerOf: (toolchain) =>
    createChecksRunner({
      fileText: createDefaultFileTextPort({}),
      fileRemoval: createDefaultFileRemovalPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      eslint: createEslintPort({ toolchain }),
      moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
    }),
});
