import { createRequire } from "node:module";

import type { PackageManifestPort } from "../../../application/ports/host/package-manifest-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";

const RESOLVING_FILE = "package.json";

export const createPackageManifestPort = (options: {
  readonly path: Pick<PathPort, "join">;
}): PackageManifestPort => ({
  locateManifestFrom: (request) => {
    try {
      return {
        outcome: "ok",
        value: createRequire(
          options.path.join({ segments: [request.folder, RESOLVING_FILE] }),
        ).resolve(`${request.packageName}/${RESOLVING_FILE}`),
      };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "package-manifest-unresolved",
          detail: thrown instanceof Error ? thrown.message : String(thrown),
        },
      };
    }
  },
});
