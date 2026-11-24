import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import { createDefaultFileRemovalPort } from "../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { installFormOf } from "../../../node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { eslintRunnerModuleOver } from "./eslint-runner-module.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "./toolchain/eslint-toolchain.ts";

export const { namedChecksRunner, measureVersionOne, versionOneProjectionOver } =
  eslintRunnerModuleOver({
    toolchain: loadEslintToolchain({
      peers: defaultEslintToolchainPeers({
        installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
        installForm: installFormOf({
          moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
        }),
      }),
    }),
    platform: {
      fileText: createDefaultFileTextPort({}),
      fileRemoval: createDefaultFileRemovalPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
    },
  });
