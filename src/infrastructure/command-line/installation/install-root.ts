import type { PathPort } from "../../node/path-port.ts";
import type { AbsolutePath } from "../../content-files/absolute-path.ts";
import { type InstallEntry, installRootAboveEntry } from "../../node/modules/install-layout.ts";
import type { Result } from "../../../domain/result.ts";
import type { LoadFailure } from "../load-failure.ts";

type ModuleEntry = Exclude<InstallEntry, "runner">;

const DIRECTORIES_ABOVE_ENTRY: Readonly<Record<ModuleEntry, string>> = {
  api: "two directories",
  command: "two directories",
};

const installRootUnresolvable = (request: {
  readonly url: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error: { kind: "install-root-unresolvable", url: request.url, detail: request.detail },
});

const installRootAbove = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
  readonly entry: ModuleEntry;
}): Result<AbsolutePath, LoadFailure> => {
  const entry = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entry.outcome === "failed") {
    return installRootUnresolvable({ url: entry.error.url, detail: entry.error.detail });
  }
  const resolved = request.path.resolve({
    path: installRootAboveEntry({
      entryFile: entry.value,
      entry: request.entry,
      directoryOf: (path) => request.path.directoryOf({ path }),
    }),
  });
  if (resolved.outcome === "failed") {
    return installRootUnresolvable({
      url: request.moduleUrl,
      detail: `the install root ${DIRECTORIES_ABOVE_ENTRY[request.entry]} above the entry file is not an absolute path`,
    });
  }
  return resolved;
};

export const installRootOf = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<AbsolutePath, LoadFailure> => installRootAbove({ ...request, entry: "command" });

export const installRootOfApiEntry = (request: {
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<AbsolutePath, LoadFailure> => installRootAbove({ ...request, entry: "api" });
