import { toolchainBoundStandaloneRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { installFormOf, moduleExtensionOf } from "../../../node/modules/install-layout.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { defaultTypeScriptPeers, loadParsePort } from "./toolchain/typescript-toolchain.ts";

export const runner = toolchainBoundStandaloneRunner({
  toolchain: loadParsePort({
    peers: defaultTypeScriptPeers({
      installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
      installForm: installFormOf({ moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }) }),
    }),
  }),
  runnerOf: (parse) =>
    createWalkerRunner({
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      parse,
      entryKind: createDefaultEntryKindPort({}),
    }),
});
