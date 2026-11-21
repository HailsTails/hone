import type { AbsolutePath } from "../src/infrastructure/content-files/absolute-path.ts";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import type { ScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import type { ScratchRepositories } from "./scratch-repositories.ts";

export const repositoryWithSubfolder = (request: {
  readonly repositories: ScratchRepositories;
  readonly scratch: Pick<ScratchFilesPort, "makeDirectory">;
  readonly fileText: Pick<FileTextPort, "write">;
  readonly files: Readonly<Record<string, string>>;
  readonly subfolder: string;
  readonly subfolderFiles: Readonly<Record<string, string>>;
}): AbsolutePath => {
  const repo = request.repositories.repositoryWith({ files: request.files });
  const folder = `${repo}/${request.subfolder}`;
  const made = request.scratch.makeDirectory({ path: folder });
  if (made.outcome !== "ok") {
    throw new Error(`a scratch subfolder could not be made at ${folder}: ${made.error.detail}`);
  }
  Object.entries(request.subfolderFiles).forEach(([name, text]) => {
    const written = request.fileText.write({ path: `${folder}/${name}`, text });
    if (written.outcome !== "ok") {
      throw new Error(`a scratch file could not be written at ${folder}/${name}: ${written.error.detail}`);
    }
  });
  return repo;
};
