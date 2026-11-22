import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { createEsbuildBundlerPort } from "../packaging/building/esbuild-bundler-port.ts";
import { PROOF_CASES } from "./install-proof-plan.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "./install-proof-ports.ts";
import { createTarballPacker } from "../packaging/packing/package-commands.ts";
import type { InstallProofRequest } from "./run-install-proof.ts";
import { createDefaultTypeScriptDeclarationPort } from "../packaging/type-declarations/typescript-declaration-port.ts";

export const defaultInstallProofRequestOf = (request: { readonly moduleUrl: string }): InstallProofRequest => ({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  scratch: createDefaultScratchFilesPort({}),
  commands: createDefaultCommandRunPort({}),
  packer: createTarballPacker({
    ports: {
      path: createDefaultPathPort({}),
      fileText: createDefaultFileTextPort({}),
      scratch: createDefaultScratchFilesPort({}),
      bundler: createEsbuildBundlerPort({ path: createDefaultPathPort({}) }),
      declarations: createDefaultTypeScriptDeclarationPort({}),
    },
    commands: createDefaultCommandRunPort({}),
  }),
  moduleUrl: request.moduleUrl,
  proofCases: PROOF_CASES,
});
