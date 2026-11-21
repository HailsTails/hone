import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";
import type { PathPort } from "../../node/path-port.ts";
import type { RunLoadFailure } from "../../../domain/report/run-load-failure.ts";
import { SETTINGS_FILE_NAME, VERSION_ONE_SETTINGS_FILE_NAME } from "../../hone-config-file/settings-sources.ts";
import type { AbsolutePath } from "../../content-files/absolute-path.ts";
import type { Result } from "../../../domain/result.ts";

export type RunPath = "version-1" | "version-2" | "no-settings";

type RunPathRequest = {
  readonly fileText: Pick<FileTextPort, "exists">;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
};

const presenceOf = (request: RunPathRequest & { readonly name: string }): FilePresence =>
  request.fileText.exists({ path: request.path.join({ segments: [request.repoRoot, request.name] }) });

export const runPathOf = (request: RunPathRequest): Result<RunPath, RunLoadFailure> => {
  const versionOne = presenceOf({ ...request, name: VERSION_ONE_SETTINGS_FILE_NAME });
  const versionTwo = presenceOf({ ...request, name: SETTINGS_FILE_NAME });
  if (versionOne === "present" && versionTwo === "present") {
    return { outcome: "failed", error: { kind: "settings-in-both-versions", repo: request.repoRoot } };
  }
  if (versionOne === "present") {
    return { outcome: "ok", value: "version-1" };
  }
  return { outcome: "ok", value: versionTwo === "present" ? "version-2" : "no-settings" };
};
