import { z } from "zod";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { ToolIdentity } from "../../src/domain/rule-set/tool-identity.ts";

const releaseTextArgumentsSchema = z.tuple([z.enum(["title", "notes", "dist-tag"]), z.string().min(1)]);

export type ReleaseTextPart = z.infer<typeof releaseTextArgumentsSchema>[0];

export type DistTag = "next" | "latest";

const USAGE = "usage: release-text <title|notes|dist-tag> <tag>\n";

const BUILD_METADATA_SEPARATOR = "+";

const PRE_RELEASE_SEPARATOR = "-";

export const distTagOf = (request: { readonly tag: string }): DistTag => {
  const [versionBeforeBuildMetadata = request.tag] = request.tag.split(BUILD_METADATA_SEPARATOR);
  return versionBeforeBuildMetadata.includes(PRE_RELEASE_SEPARATOR) ? "next" : "latest";
};

export const releaseTextOf = (request: {
  readonly identity: ToolIdentity;
  readonly tag: string;
  readonly part: ReleaseTextPart;
}): string => {
  const title = `${request.identity.name} ${request.tag}`;
  switch (request.part) {
    case "title":
      return title;
    case "notes":
      return `Install it with \`npm install --save-dev ${request.identity.packageName}@${distTagOf({ tag: request.tag })}\` once it is approved on npm, or install the attached tarball. The package is ${request.identity.packageName}, not the unscoped ${request.identity.unrelatedNpmPackage}, which is an unrelated npm package; it provides the command ${request.identity.command}.`;
    case "dist-tag":
      return distTagOf({ tag: request.tag });
  }
};

export const runReleaseText = (request: { readonly process: ProcessPort; readonly identity: ToolIdentity }): void => {
  const parsed = releaseTextArgumentsSchema.safeParse(request.process.arguments);
  if (!parsed.success) {
    request.process.writeError({ text: USAGE });
    request.process.exitWith({ code: 2 });
    return;
  }
  const [part, tag] = parsed.data;
  request.process.writeOut({ text: releaseTextOf({ identity: request.identity, tag, part }) });
  request.process.exitWith({ code: 0 });
};
