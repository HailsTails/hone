import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { installFormOf } from "../../../node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { toolchainBoundNamedChecksRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { defaultTypeScriptPeers, loadParsePort } from "./toolchain/typescript-toolchain.ts";

export const namedChecksRunner = toolchainBoundNamedChecksRunner({
  fileScope: "tracked",
  toolchain: loadParsePort({
    peers: defaultTypeScriptPeers({
      installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
      installForm: installFormOf({
        moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
      }),
    }),
  }),
  projectedKinds: ["inline-disable"],
  runnerOf: (parse) =>
    createWalkerRunner({
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      parse,
      entryKind: createDefaultEntryKindPort({}),
    }),
});
