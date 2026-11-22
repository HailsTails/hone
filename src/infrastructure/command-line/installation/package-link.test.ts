import { describe, expect, it, vi } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-system-port.ts";
import { createDefaultPathPort, createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { linkOver, manifestReaderOver, type ManifestAt, type PackageManifest } from "./package-link.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const MANIFEST: PackageManifest = { name: "@hailstails/hone", version: "1.0.0" };

const OTHER_VERSION: PackageManifest = { name: "@hailstails/hone", version: "0.9.0" };

const STORE_ROOT = absoluteRootOf("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone");

const LINK_ROOT = "/repo/node_modules/@hailstails/hone";

const posix = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const linkFor = (request: { readonly manifestAt: ManifestAt; readonly installRoot: string }) =>
  linkOver({
    path: posix,
    manifestAt: request.manifestAt,
    repoRoot: absoluteRootOf("/repo"),
    installRoot: absolutePathSchema.parse(request.installRoot),
  });

describe("manifestReaderOver", () => {
  const readerOverFixtures = manifestReaderOver({
    path: createDefaultPathPort({}),
    fileText: createDefaultFileTextPort({}),
  });

  it("reads the name and version from the package.json in the folder", () => {
    expect(readerOverFixtures({ root: `${import.meta.dirname}/package-manifests/complete` })).toEqual(MANIFEST);
  });

  it("reads nothing from a folder with no package.json", () => {
    expect(readerOverFixtures({ root: `${import.meta.dirname}/package-manifests/absent` })).toBeUndefined();
  });

  it("reads nothing from a package.json holding an empty object", () => {
    expect(readerOverFixtures({ root: `${import.meta.dirname}/package-manifests/empty-object` })).toBeUndefined();
  });

  it("reads nothing from a package.json without a version", () => {
    expect(readerOverFixtures({ root: `${import.meta.dirname}/package-manifests/without-version` })).toBeUndefined();
  });
});

describe("linkOver", () => {
  it("links the running install to the repository's node_modules entry when that entry holds the same package manifest", () => {
    const manifestAt = vi.fn<ManifestAt>().mockReturnValueOnce(MANIFEST).mockReturnValueOnce(MANIFEST);

    expect({ link: linkFor({ manifestAt, installRoot: STORE_ROOT }), read: manifestAt.mock.calls }).toEqual({
      link: { kind: "linked", installRoot: STORE_ROOT, linkRoot: LINK_ROOT },
      read: [[{ root: STORE_ROOT }], [{ root: LINK_ROOT }]],
    });
  });

  it("links without reading when the install already runs from the repository's node_modules entry", () => {
    const manifestAt = vi.fn<ManifestAt>();

    expect({ link: linkFor({ manifestAt, installRoot: LINK_ROOT }), read: manifestAt.mock.calls }).toEqual({
      link: { kind: "linked", installRoot: LINK_ROOT, linkRoot: LINK_ROOT },
      read: [],
    });
  });

  it("leaves the install unlinked when the repository has no node_modules entry for the package", () => {
    const manifestAt = vi.fn<ManifestAt>().mockReturnValueOnce(MANIFEST).mockReturnValueOnce(undefined);

    expect({ link: linkFor({ manifestAt, installRoot: STORE_ROOT }), read: manifestAt.mock.calls }).toEqual({
      link: { kind: "unlinked" },
      read: [[{ root: STORE_ROOT }], [{ root: LINK_ROOT }]],
    });
  });

  it("leaves the install unlinked when the entry holds another version", () => {
    const manifestAt = vi.fn<ManifestAt>().mockReturnValueOnce(MANIFEST).mockReturnValueOnce(OTHER_VERSION);

    expect({ link: linkFor({ manifestAt, installRoot: STORE_ROOT }), read: manifestAt.mock.calls }).toEqual({
      link: { kind: "unlinked" },
      read: [[{ root: STORE_ROOT }], [{ root: LINK_ROOT }]],
    });
  });

  it("leaves the install unlinked, without reading the entry, when the running install's manifest cannot be read", () => {
    const manifestAt = vi.fn<ManifestAt>().mockReturnValueOnce(undefined);

    expect({ link: linkFor({ manifestAt, installRoot: STORE_ROOT }), read: manifestAt.mock.calls }).toEqual({
      link: { kind: "unlinked" },
      read: [[{ root: STORE_ROOT }]],
    });
  });
});
