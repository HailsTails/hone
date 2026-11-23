import { moduleExtensionOf } from "../../../../application/ports/host/module-extension.ts";
import type { ImportsRewrittenOf } from "../../../../application/ports/upgrade/version-one-team-layout.ts";
import type { Result } from "../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { installFormOf } from "../../../node/modules/install-layout.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort, createPathPort } from "../../../node/path-port.ts";
import { toolchainBoundNamedChecksRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { createImportsRewrittenOf } from "./moved-imports.ts";
import { defaultTypeScriptPeers, loadParsePort } from "./toolchain/typescript-toolchain.ts";

const parsePort = loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }),
    installForm: installFormOf({
      moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
    }),
  }),
});

export const namedChecksRunner = toolchainBoundNamedChecksRunner({
  fileScope: "tracked",
  toolchain: parsePort,
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

export const importsRewriterOf = (): Promise<Result<ImportsRewrittenOf, RunnerFailure>> =>
  parsePort.then((parse) =>
    parse.outcome === "failed"
      ? parse
      : {
          outcome: "ok",
          value: createImportsRewrittenOf({
            path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
            parse: parse.value,
          }),
        },
  );
