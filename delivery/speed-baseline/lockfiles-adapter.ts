import type { DirectoryPort } from "../../src/application/ports/file-system/directory-port.ts";
import type { LockfilesPort } from "./lockfiles-port.ts";

export const createLockfilesPort = (options: {
  readonly directories: Pick<DirectoryPort, "list">;
}): LockfilesPort => ({
  read: (request) => {
    const entries = options.directories.list({ path: request.directory });
    return entries.outcome === "failed"
      ? { outcome: "failed", error: { kind: "lockfiles-unread", detail: entries.error.detail } }
      : {
          outcome: "ok",
          value: entries.value.filter((entry) => entry.kind === "file").map((entry) => entry.name),
        };
  },
});
