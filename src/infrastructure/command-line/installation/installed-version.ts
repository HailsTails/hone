import { z } from "zod";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../node/path-port.ts";
import type { Result } from "../../../domain/result.ts";
import { parsedJson } from "../../content-files/parsed-json.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "../load-failure.ts";
import { UNLINKED } from "./package-link.ts";
import { shownFailureOf } from "./shown-path.ts";

const PACKAGE_MANIFEST = "package.json";

const versionedManifestSchema = z.looseObject({ version: z.string() });

const malformed = (request: { readonly path: string; readonly detail: string }): Result<string, LoadFailure> => ({
  outcome: "failed",
  error: { kind: "file-malformed", path: request.path, detail: request.detail },
});

const versionIn = (request: { readonly path: string; readonly text: string }): Result<string, LoadFailure> => {
  const json = parsedJson(request);
  if (json.outcome === "failed") {
    return malformed({ path: request.path, detail: `${PACKAGE_MANIFEST} is not valid JSON: ${json.error}` });
  }
  const manifest = versionedManifestSchema.safeParse(json.value);
  return manifest.success
    ? { outcome: "ok", value: manifest.data.version }
    : malformed({ path: request.path, detail: `${PACKAGE_MANIFEST} holds no version` });
};

const versionAt = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<string, LoadFailure> => {
  const installRoot = installRootOf(request);
  if (installRoot.outcome === "failed") {
    return installRoot;
  }
  const manifestPath = request.path.join({ segments: [installRoot.value, PACKAGE_MANIFEST] });
  const text = request.fileText.read({ path: manifestPath });
  return text.outcome === "failed"
    ? { outcome: "failed", error: { kind: "file-unreadable", path: manifestPath, detail: text.error.detail } }
    : versionIn({ path: manifestPath, text: text.value });
};

export const installedVersionOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<string, LoadFailure> => {
  const version = versionAt(request);
  return version.outcome === "failed"
    ? { outcome: "failed", error: shownFailureOf({ failure: version.error, path: request.path, repoRoot: undefined, link: UNLINKED }) }
    : version;
};
