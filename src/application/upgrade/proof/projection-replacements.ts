import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ReplacementRefusal } from "../../ports/upgrade/plan-refusal.ts";
import { rewrittenConfigOf } from "../writing/config-import-rewrite.ts";
import { directoryOf } from "../writing/relative-specifier.ts";
import type { PlannedRepoFile } from "./planned-repo-file.ts";
import type { VersionOneProjection } from "./team-config-finder.ts";

const PATH_SEPARATOR = "/";

type Pair = { readonly version: VersionOneProjection; readonly projected: PlannedRepoFile };

const folderOf = (request: { readonly file: RepoPath }): string =>
  directoryOf({ file: request.file }).join(PATH_SEPARATOR);

const pairOf = (request: {
  readonly version: VersionOneProjection;
  readonly projected: readonly PlannedRepoFile[];
}): Result<Pair, ReplacementRefusal> => {
  const folder = folderOf({ file: request.version.projection });
  const projected = request.projected.find(
    (candidate) => folderOf({ file: candidate.file }) === folder,
  );
  return projected === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-one-projection-unpaired",
            projection: request.version.projection,
            config: request.version.teamConfigs[0].file,
            folder,
          },
        },
      }
    : { outcome: "ok", value: { version: request.version, projected } };
};

const pairsOf = (request: {
  readonly projections: readonly VersionOneProjection[];
  readonly projected: readonly PlannedRepoFile[];
}): Result<readonly Pair[], ReplacementRefusal> => {
  const pairs = request.projections.map((version) =>
    pairOf({ version, projected: request.projected }),
  );
  const unpaired = pairs.find((pair) => pair.outcome === "failed");
  return (
    unpaired ?? {
      outcome: "ok",
      value: pairs.flatMap((pair) => (pair.outcome === "ok" ? [pair.value] : [])),
    }
  );
};

const unpairedProjectedOf = (request: {
  readonly pairs: readonly Pair[];
  readonly projected: readonly PlannedRepoFile[];
}): PlannedRepoFile | undefined =>
  request.projected.find(
    (candidate) => !request.pairs.some((pair) => pair.projected.file === candidate.file),
  );

const rewrittenConfigIn = (request: {
  readonly config: PlannedRepoFile;
  readonly pairs: readonly Pair[];
}): Result<PlannedRepoFile, ReplacementRefusal> => {
  const rewritten = rewrittenConfigOf({
    file: request.config.file,
    text: request.config.text,
    pairs: request.pairs.map((pair) => ({
      versionOneProjection: pair.version.projection,
      versionTwoProjection: pair.projected.file,
    })),
  });
  return rewritten.outcome === "ok"
    ? { outcome: "ok", value: { file: request.config.file, text: rewritten.value } }
    : { outcome: "failed", error: { kind: "config-import-refused", refusal: rewritten.error } };
};

const importedBy = (request: {
  readonly pairs: readonly Pair[];
  readonly config: PlannedRepoFile;
}): readonly Pair[] =>
  request.pairs.filter((pair) =>
    pair.version.teamConfigs.some(({ file }) => file === request.config.file),
  );

const configsOf = (request: { readonly pairs: readonly Pair[] }): readonly PlannedRepoFile[] => {
  const configs = request.pairs.flatMap((pair) => pair.version.teamConfigs);
  return configs.filter(
    (config, index) => configs.findIndex(({ file }) => file === config.file) === index,
  );
};

export const replacementsOf = (request: {
  readonly projections: readonly VersionOneProjection[];
  readonly projected: readonly PlannedRepoFile[];
}): Result<readonly PlannedRepoFile[], ReplacementRefusal> => {
  const pairs = pairsOf(request);
  if (pairs.outcome === "failed") {
    return pairs;
  }
  const alone = unpairedProjectedOf({ pairs: pairs.value, projected: request.projected });
  if (alone !== undefined) {
    return {
      outcome: "failed",
      error: {
        kind: "projections-unpaired",
        refusal: {
          kind: "version-two-projection-unpaired",
          file: alone.file,
          folder: folderOf({ file: alone.file }),
        },
      },
    };
  }
  const rewritten = configsOf({ pairs: pairs.value }).map((config) =>
    rewrittenConfigIn({ config, pairs: importedBy({ pairs: pairs.value, config }) }),
  );
  const refused = rewritten.find((each) => each.outcome === "failed");
  return (
    refused ?? {
      outcome: "ok",
      value: rewritten.flatMap((each) => (each.outcome === "ok" ? [each.value] : [])),
    }
  );
};
