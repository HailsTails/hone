import { describe, expect, it } from "vitest";

import { createDefaultPathPort } from "../path-port.ts";
import { createPackageManifestPort } from "./package-manifest-port.ts";

describe("createPackageManifestPort locateManifestFrom through node", () => {
  it("locates an installed package's manifest at the same real path from the repository root and from a folder inside it", () => {
    const path = createDefaultPathPort({});
    const root = path.join({ segments: [import.meta.dirname, "..", "..", "..", ".."] });
    const manifests = createPackageManifestPort({ path });

    const fromRoot = manifests.locateManifestFrom({ packageName: "zod", folder: root });
    const fromInside = manifests.locateManifestFrom({
      packageName: "zod",
      folder: path.join({ segments: [root, "src"] }),
    });

    expect({ fromRoot, sameAsInside: fromInside }).toEqual({
      fromRoot: { outcome: "ok", value: expect.stringMatching(/[\\/]zod[\\/]package\.json$/) },
      sameAsInside: fromRoot,
    });
  });

  it("carries node's refusal when the package cannot be resolved from the folder", () => {
    const manifests = createPackageManifestPort({ path: createDefaultPathPort({}) });

    const located = manifests.locateManifestFrom({
      packageName: "hone-absent-package",
      folder: "/",
    });

    expect(located).toEqual({
      outcome: "failed",
      error: {
        kind: "package-manifest-unresolved",
        detail: expect.stringContaining("hone-absent-package/package.json"),
      },
    });
  });
});
