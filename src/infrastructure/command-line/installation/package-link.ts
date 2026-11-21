import { z } from "zod";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../node/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { parsedJson } from "../../content-files/parsed-json.ts";
import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";

export type PackageLink =
  | { readonly kind: "linked"; readonly installRoot: AbsolutePath; readonly linkRoot: string }
  | { readonly kind: "unlinked" };

export const UNLINKED: PackageLink = { kind: "unlinked" };

export type PackageManifest = { readonly name: string; readonly version: string };

export type ManifestAt = (request: { readonly root: string }) => PackageManifest | undefined;

const INSTALL_FOLDER = "node_modules";

const PACKAGE_MANIFEST = "package.json";

const manifestSchema = z.object({ name: z.string(), version: z.string() });

type LinkRequest = {
  readonly path: PathPort;
  readonly manifestAt: ManifestAt;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

export const manifestReaderOver = (request: {
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "read">;
}): ManifestAt =>
  ({ root }) => {
    const read = request.fileText.read({ path: request.path.join({ segments: [root, PACKAGE_MANIFEST] }) });
    const json = read.outcome === "ok" ? parsedJson({ text: read.value }) : undefined;
    const manifest = json?.outcome === "ok" ? manifestSchema.safeParse(json.value) : undefined;
    return manifest?.success ? manifest.data : undefined;
  };

const sameFolder = (request: { readonly path: PathPort; readonly from: string; readonly to: string }): "same" | "different" => {
  const location = request.path.relative(request);
  return location.relation === "within-root" && location.path === "" ? "same" : "different";
};

const sameManifest = (request: { readonly left: PackageManifest; readonly right: PackageManifest | undefined }): "same" | "different" =>
  request.right !== undefined && request.left.name === request.right.name && request.left.version === request.right.version ? "same" : "different";

const holdsRunningPackage = (request: LinkRequest & { readonly linkRoot: string }): "holds" | "does-not-hold" => {
  const running = request.manifestAt({ root: request.installRoot });
  return running !== undefined && sameManifest({ left: running, right: request.manifestAt({ root: request.linkRoot }) }) === "same" ? "holds" : "does-not-hold";
};

export const linkOver = (request: LinkRequest): PackageLink => {
  const linkRoot = request.path.join({ segments: [request.repoRoot, INSTALL_FOLDER, TOOL_IDENTITY.packageName] });
  const linked: PackageLink = { kind: "linked", installRoot: request.installRoot, linkRoot };
  if (sameFolder({ path: request.path, from: linkRoot, to: request.installRoot }) === "same") {
    return linked;
  }
  return holdsRunningPackage({ ...request, linkRoot }) === "holds" ? linked : UNLINKED;
};

export const packageLinkOf = (request: {
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}): PackageLink => linkOver({ ...request, manifestAt: manifestReaderOver(request) });
