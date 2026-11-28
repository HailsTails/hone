import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { gatheredOutcomes } from "../../src/domain/gathered-outcomes.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultDirectoryTreePort } from "../../src/infrastructure/node/file-system/directory-tree-port.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createModuleImportsReader,
  type ModuleImport,
  type ReadModuleImports,
} from "./module-imports.ts";
import { listSourceFiles, type SourceTree } from "./source-files.ts";

export type SourceImports = {
  readonly file: string;
  readonly imports: readonly ModuleImport[];
};

type SourceReading = SourceTree & {
  readonly fileText: Pick<FileTextPort, "read">;
  readonly readModuleImports: ReadModuleImports;
};

const readFileImports = (
  request: SourceReading & { readonly file: string },
): Result<readonly SourceImports[], string> => {
  const { file } = request;
  const text = request.fileText.read({
    path: request.path.join({ segments: [request.repoRoot, file] }),
  });
  return text.outcome === "failed"
    ? { outcome: "failed", error: `${file}: ${text.error.detail}` }
    : {
        outcome: "ok",
        value: [{ file, imports: request.readModuleImports({ file, text: text.value }) }],
      };
};

export const readSourceImports = (
  request: SourceReading,
): Result<readonly SourceImports[], string> => {
  const files = listSourceFiles(request);
  return files.outcome === "failed"
    ? files
    : gatheredOutcomes({
        outcomes: files.value.map((file) => readFileImports({ ...request, file })),
      });
};

export const readRepositoryImports = async (request: {
  readonly repoRoot: AbsolutePath;
}): Promise<Result<readonly SourceImports[], string>> => {
  const parse = await loadParsePort({
    peers: defaultTypeScriptPeers({ installRoot: request.repoRoot, installForm: "source" }),
  });
  return parse.outcome === "failed"
    ? { outcome: "failed", error: parse.error.kind }
    : readSourceImports({
        repoRoot: request.repoRoot,
        directory: createDefaultDirectoryPort({}),
        directoryTree: createDefaultDirectoryTreePort({}),
        fileText: createDefaultFileTextPort({}),
        path: createDefaultPathPort({}),
        readModuleImports: createModuleImportsReader({ parse: parse.value }),
      });
};
