import { describe, expect, it } from "vitest";

import { createDefaultPathPort } from "../path-port.ts";
import { createPackageManifestPort } from "./package-manifest-port.ts";

describe("createPackageManifestPort", () => {
  it("locates a package's manifest as node resolves it from the folder it is given", () => {
    const manifests = createPackageManifestPort({ path: createDefaultPathPort({}) });

    const located = manifests.locateManifestFrom({
      packageName: "zod",
      folder: import.meta.dirname,
    });

    expect(located).toEqual({
      outcome: "ok",
      value: expect.stringMatching(/[\\/]zod[\\/]package\.json$/),
    });
  });
});
