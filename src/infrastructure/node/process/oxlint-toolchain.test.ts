import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PackageManifestPort } from "../../../application/ports/host/package-manifest-port.ts";
import { createReadOxlintToolchain } from "./oxlint-toolchain.ts";

describe("readOxlintToolchain", () => {
  it("names an unsupported Oxlint version and missing plugin peers", () => {
    const locateManifestFrom = vi
      .fn<PackageManifestPort["locateManifestFrom"]>()
      .mockReturnValueOnce({ outcome: "ok", value: "/repo/oxlint/package.json" })
      .mockReturnValue({
        outcome: "failed",
        error: { kind: "package-manifest-unresolved", detail: "Not installed" },
      });
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: '{"version":"1.94.0"}' });
    const readToolchain = createReadOxlintToolchain({
      text: { read },
      manifests: { locateManifestFrom },
    });

    const toolchain = readToolchain({ folder: "/repo", peerFolders: ["/install/piece"] });

    expect(toolchain).toEqual({
      outcome: "failed",
      error: {
        kind: "toolchain-unavailable",
        peers: [
          { packageName: "oxlint", peer: "optional", supported: "^1.95.0", found: "1.94.0" },
          {
            packageName: "eslint",
            peer: "optional",
            supported: "^9.39.5 || ^10.15.0",
            found: "not installed",
          },
          {
            packageName: "@typescript-eslint/parser",
            peer: "optional",
            supported: "^8.73.0",
            found: "not installed",
          },
          {
            packageName: "@typescript-eslint/eslint-plugin",
            peer: "optional",
            supported: "^8.73.0",
            found: "not installed",
          },
        ],
      },
    });
  });
});
