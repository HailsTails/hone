import { createDefaultFileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "../../../src/infrastructure/node/process/process-port.ts";
import { createEsbuildBundlerPort } from "../building/esbuild-bundler-port.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "../../install-proof/install-proof-ports.ts";
import { runPackPackage } from "./package-commands.ts";
import { createDefaultTypeScriptDeclarationPort } from "../type-declarations/typescript-declaration-port.ts";

await runPackPackage({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  scratch: createDefaultScratchFilesPort({}),
  bundler: createEsbuildBundlerPort({ path: createDefaultPathPort({}) }),
  declarations: createDefaultTypeScriptDeclarationPort({}),
  commands: createDefaultCommandRunPort({}),
  moduleUrl: import.meta.url,
});
