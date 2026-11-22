import { z } from "zod";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleExtension } from "../../../../../application/ports/host/module-extension.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { parsedJson } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import { installFormOf } from "../../../../node/modules/install-layout.ts";

export type CoreInstall =
  | { readonly form: "source" }
  | { readonly form: "package"; readonly root: string; readonly name: string };

const INSTALL_MANIFEST = "package.json";

const namedManifestSchema = z.object({ name: z.string() });

const manifestFailure = (request: {
  readonly manifest: string;
  readonly problem: string;
}): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: {
    kind: "tool-failed",
    detail: `the core install's ${request.manifest} ${request.problem}`,
  },
});

const packageNamedIn = (request: {
  readonly installRoot: AbsolutePath;
  readonly manifest: string;
  readonly text: string;
}): Result<CoreInstall, RunnerFailure> => {
  const document = parsedJson({ text: request.text });
  if (document.outcome === "failed") {
    return manifestFailure({
      manifest: request.manifest,
      problem: `is not JSON: ${document.error}`,
    });
  }
  const named = namedManifestSchema.safeParse(document.value);
  return named.success
    ? {
        outcome: "ok",
        value: { form: "package", root: request.installRoot, name: named.data.name },
      }
    : manifestFailure({ manifest: request.manifest, problem: "names no package" });
};

export const coreInstallOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): Result<CoreInstall, RunnerFailure> => {
  if (installFormOf({ moduleExtension: request.moduleExtension }) === "source") {
    return { outcome: "ok", value: { form: "source" } };
  }
  const manifest = request.path.join({ segments: [request.installRoot, INSTALL_MANIFEST] });
  const text = request.fileText.read({ path: manifest });
  return text.outcome === "failed"
    ? manifestFailure({ manifest, problem: `cannot be read: ${text.error.detail}` })
    : packageNamedIn({ installRoot: request.installRoot, manifest, text: text.value });
};
