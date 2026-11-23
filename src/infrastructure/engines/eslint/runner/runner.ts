import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import type { Result } from "../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { createDefaultFileRemovalPort } from "../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { installFormOf } from "../../../node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import {
  bindEslintChecksModule,
  createChecksRunner,
  type EslintChecksRunner,
} from "./checks-runner/checks-runner.ts";
import { ESLINT_PROJECTED_KINDS } from "./embedded-runner/create-eslint-runner.ts";
import { createEslintPort } from "./toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "./toolchain/eslint-toolchain.ts";

export { versionOneProjectionOver } from "./embedded-runner/create-eslint-runner.ts";

const runner = loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
    installForm: installFormOf({
      moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
    }),
  }),
}).then((loaded): Result<EslintChecksRunner, RunnerFailure> =>
  loaded.outcome === "failed"
    ? loaded
    : {
        outcome: "ok",
        value: createChecksRunner({
          fileText: createDefaultFileTextPort({}),
          fileRemoval: createDefaultFileRemovalPort({}),
          modules: createDefaultModuleLoaderPort({}),
          path: createDefaultPathPort({}),
          eslint: createEslintPort({ toolchain: loaded.value }),
          moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
        }),
      },
);

export const { namedChecksRunner, measureVersionOne } = bindEslintChecksModule({
  runner,
  projectedKinds: ESLINT_PROJECTED_KINDS,
});
