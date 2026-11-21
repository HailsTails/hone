import { z } from "zod";
import { parsedJson } from "../../../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import type { PeerKind } from "../../../src/domain/runner/runner-failure.ts";
import type { Result } from "../../../src/domain/result.ts";
import type { ToolIdentity } from "../../../src/domain/rule-set/tool-identity.ts";

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

export type TypedExport = { readonly subpath: string; readonly declaration: string; readonly module: string };

type TypedExportConditions = { readonly types: string; readonly default: string };

const versionsSchema = z.record(z.string(), z.string());

const publishedSectionsSchema = z.object({
  version: z.string(),
  keywords: z.array(z.string()),
  license: z.string(),
  author: z.string(),
  dependencies: versionsSchema,
  peerDependencies: versionsSchema,
  peerDependenciesMeta: z.record(z.string(), z.object({ optional: z.boolean() })),
});

const peerSectionsSchema = publishedSectionsSchema.pick({ peerDependencies: true });

const peerKindSectionsSchema = z.object({
  peerDependencies: versionsSchema,
  peerDependenciesMeta: publishedSectionsSchema.shape.peerDependenciesMeta.default({}),
});

const dependencySectionsSchema = publishedSectionsSchema.pick({ dependencies: true });

const versionSectionSchema = publishedSectionsSchema.pick({ version: true });

const MANIFEST_EXPORT = "./package.json";

const exportPathOf = (path: string): string => `./${path}`;

const typedExportEntry = (request: { readonly typed: TypedExport }): readonly [string, TypedExportConditions] => [
  exportPathOf(request.typed.subpath),
  { types: exportPathOf(request.typed.declaration), default: exportPathOf(request.typed.module) },
];

const bareExportEntry = (request: { readonly path: string }): readonly [string, string] => [request.path, request.path];

type RepositoryLinks = {
  readonly repository: { readonly type: "git"; readonly url: string };
  readonly homepage: string;
  readonly bugs: { readonly url: string };
};

const PUBLIC_ACCESS = { access: "public" } as const;

const repositoryLinksOf = (request: { readonly repository: string }): RepositoryLinks => ({
  repository: { type: "git", url: `git+${request.repository}.git` },
  homepage: `${request.repository}#readme`,
  bugs: { url: `${request.repository}/issues` },
});

const manifestText = (request: { readonly manifest: object }): string => `${JSON.stringify(request.manifest, null, 2)}\n`;

const sectionsOf = <Sections>(request: {
  readonly developmentManifest: string;
  readonly schema: z.ZodType<Sections>;
}): Result<Sections, ManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "manifest-invalid", detail: parsed.error } };
  }
  const sections = request.schema.safeParse(parsed.value);
  return sections.success
    ? { outcome: "ok", value: sections.data }
    : { outcome: "failed", error: { kind: "manifest-invalid", detail: sections.error.message } };
};

export const peerNamesOf = (request: {
  readonly developmentManifest: string;
}): Result<readonly string[], ManifestFailure> => {
  const peers = sectionsOf({ developmentManifest: request.developmentManifest, schema: peerSectionsSchema });
  return peers.outcome === "failed" ? peers : { outcome: "ok", value: Object.keys(peers.value.peerDependencies) };
};

export const peerKindsOf = (request: {
  readonly developmentManifest: string;
}): Result<Readonly<Record<string, PeerKind>>, ManifestFailure> => {
  const peers = sectionsOf({ developmentManifest: request.developmentManifest, schema: peerKindSectionsSchema });
  return peers.outcome === "failed"
    ? peers
    : {
        outcome: "ok",
        value: Object.fromEntries(
          Object.keys(peers.value.peerDependencies).map((name): readonly [string, PeerKind] => [
            name,
            peers.value.peerDependenciesMeta[name]?.optional === true ? "optional" : "required",
          ]),
        ),
      };
};

export type DependencyRanges = Readonly<Record<string, string>>;

export const dependencyRangesOf = (request: {
  readonly developmentManifest: string;
}): Result<DependencyRanges, ManifestFailure> => {
  const sections = sectionsOf({ developmentManifest: request.developmentManifest, schema: dependencySectionsSchema });
  return sections.outcome === "failed" ? sections : { outcome: "ok", value: sections.value.dependencies };
};

export const packageVersionOf = (request: { readonly developmentManifest: string }): Result<string, ManifestFailure> => {
  const sections = sectionsOf({ developmentManifest: request.developmentManifest, schema: versionSectionSchema });
  return sections.outcome === "failed" ? sections : { outcome: "ok", value: sections.value.version };
};

export const publishManifestOf = (request: {
  readonly developmentManifest: string;
  readonly identity: ToolIdentity;
  readonly command: string;
  readonly files: readonly string[];
  readonly exported: readonly string[];
  readonly typed: readonly TypedExport[];
  readonly nodeRange: string;
}): Result<string, ManifestFailure> => {
  const published = sectionsOf({ developmentManifest: request.developmentManifest, schema: publishedSectionsSchema });
  if (published.outcome === "failed") {
    return published;
  }
  return {
    outcome: "ok",
    value: manifestText({
      manifest: {
        name: request.identity.packageName,
        version: published.value.version,
        description: request.identity.description,
        keywords: published.value.keywords,
        license: published.value.license,
        author: published.value.author,
        ...repositoryLinksOf({ repository: request.identity.repository }),
        publishConfig: PUBLIC_ACCESS,
        type: "module",
        bin: { [request.identity.command]: request.command },
        exports: Object.fromEntries([
          bareExportEntry({ path: MANIFEST_EXPORT }),
          ...request.typed.map((typed) => typedExportEntry({ typed })),
          ...request.exported.map((path) => bareExportEntry({ path: exportPathOf(path) })),
        ]),
        files: request.files,
        engines: { node: request.nodeRange },
        dependencies: published.value.dependencies,
        peerDependencies: published.value.peerDependencies,
        peerDependenciesMeta: published.value.peerDependenciesMeta,
      },
    }),
  };
};
