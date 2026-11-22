import type { Result } from "../../src/domain/result.ts";
import type { ChangeEntry } from "../commit-subject/conventional-subject.ts";

export type PreRelease = { readonly identifier: string; readonly number: number };

export type Version = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly preRelease: PreRelease | undefined;
};

export type ReleaseSize = "major" | "minor" | "patch";

export type ReleaseChannel = "pre-release" | "stable";

export type Release = { readonly tag: string; readonly version: Version };

export type ReleaseLine = { readonly latest: Release; readonly start: Release };

export const RELEASE_TAG_PREFIX = "v";

const VERSION_SHAPE =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<identifier>[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)\.(?<number>0|[1-9]\d*))?$/;

const SIZES_LARGEST_FIRST: readonly ReleaseSize[] = ["major", "minor", "patch"];

const NEW_PRE_RELEASE_IDENTIFIER = "pre";

const FIRST_PRE_RELEASE_NUMBER = 1;

export const versionOf = (request: { readonly text: string }): Result<Version, string> => {
  const groups = VERSION_SHAPE.exec(request.text)?.groups;
  if (groups?.major === undefined || groups.minor === undefined || groups.patch === undefined) {
    return {
      outcome: "failed",
      error: `${request.text} is not a version this script prepares: major.minor.patch, optionally followed by -<identifier>.<number>`,
    };
  }
  return {
    outcome: "ok",
    value: {
      major: Number(groups.major),
      minor: Number(groups.minor),
      patch: Number(groups.patch),
      preRelease:
        groups.identifier === undefined
          ? undefined
          : { identifier: groups.identifier, number: Number(groups.number) },
    },
  };
};

export const versionText = (request: { readonly version: Version }): string => {
  const core = `${request.version.major}.${request.version.minor}.${request.version.patch}`;
  return request.version.preRelease === undefined
    ? core
    : `${core}-${request.version.preRelease.identifier}.${request.version.preRelease.number}`;
};

export const channelOf = (request: { readonly version: Version }): ReleaseChannel =>
  request.version.preRelease === undefined ? "stable" : "pre-release";

const asciiOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const preReleasePrecedence = (request: {
  readonly left: PreRelease | undefined;
  readonly right: PreRelease | undefined;
}): number => {
  if (request.left === undefined || request.right === undefined) {
    return Number(request.left === undefined) - Number(request.right === undefined);
  }
  return request.left.identifier === request.right.identifier
    ? request.left.number - request.right.number
    : asciiOrder({ left: request.left.identifier, right: request.right.identifier });
};

const precedence = (request: { readonly left: Version; readonly right: Version }): number =>
  request.left.major - request.right.major ||
  request.left.minor - request.right.minor ||
  request.left.patch - request.right.patch ||
  preReleasePrecedence({ left: request.left.preRelease, right: request.right.preRelease });

const releaseOfTag = (request: { readonly tag: string }): readonly Release[] => {
  if (!request.tag.startsWith(RELEASE_TAG_PREFIX)) {
    return [];
  }
  const version = versionOf({ text: request.tag.slice(RELEASE_TAG_PREFIX.length) });
  return version.outcome === "ok" ? [{ tag: request.tag, version: version.value }] : [];
};

export const releaseLineOf = (request: {
  readonly tags: readonly string[];
}): Result<ReleaseLine, string> => {
  const releases = request.tags
    .flatMap((tag) => releaseOfTag({ tag }))
    .toSorted((left, right) => precedence({ left: right.version, right: left.version }));
  const [latest] = releases;
  const start =
    releases.find((release) => channelOf({ version: release.version }) === "stable") ??
    releases.at(-1);
  return latest === undefined || start === undefined
    ? {
        outcome: "failed",
        error: `no release tag ${RELEASE_TAG_PREFIX}<version> is merged into HEAD`,
      }
    : { outcome: "ok", value: { latest, start } };
};

export const changeSizeOf = (request: { readonly entry: ChangeEntry }): ReleaseSize => {
  if (request.entry.kind === "unclassified") {
    return request.entry.compatibility === "breaking" ? "major" : "patch";
  }
  if (request.entry.subject.compatibility === "breaking") {
    return "major";
  }
  return request.entry.subject.type === "feat" ? "minor" : "patch";
};

export const releaseSizeOf = (request: {
  readonly entries: readonly ChangeEntry[];
}): ReleaseSize | "nothing" => {
  const sizes = new Set(request.entries.map((entry) => changeSizeOf({ entry })));
  return SIZES_LARGEST_FIRST.find((size) => sizes.has(size)) ?? "nothing";
};

const sizeTargetedBy = (request: { readonly version: Version }): ReleaseSize => {
  if (request.version.patch !== 0) {
    return "patch";
  }
  return request.version.minor !== 0 ? "minor" : "major";
};

type TargetFit = "within-target" | "beyond-target";

const targetFitOf = (request: {
  readonly size: ReleaseSize;
  readonly target: ReleaseSize;
}): TargetFit =>
  SIZES_LARGEST_FIRST.indexOf(request.size) >= SIZES_LARGEST_FIRST.indexOf(request.target)
    ? "within-target"
    : "beyond-target";

const incremented = (request: {
  readonly version: Version;
  readonly size: ReleaseSize;
}): Version => {
  switch (request.size) {
    case "major":
      return { major: request.version.major + 1, minor: 0, patch: 0, preRelease: undefined };
    case "minor":
      return {
        major: request.version.major,
        minor: request.version.minor + 1,
        patch: 0,
        preRelease: undefined,
      };
    case "patch":
      return {
        major: request.version.major,
        minor: request.version.minor,
        patch: request.version.patch + 1,
        preRelease: undefined,
      };
  }
};

const onChannel = (request: {
  readonly version: Version;
  readonly channel: ReleaseChannel;
  readonly preRelease: PreRelease;
}): Version =>
  request.channel === "stable"
    ? { ...request.version, preRelease: undefined }
    : { ...request.version, preRelease: request.preRelease };

export const nextVersionOf = (request: {
  readonly current: Version;
  readonly size: ReleaseSize;
  readonly channel: ReleaseChannel;
}): Version => {
  const currentPreRelease = request.current.preRelease;
  if (
    currentPreRelease !== undefined &&
    targetFitOf({ size: request.size, target: sizeTargetedBy({ version: request.current }) }) ===
      "within-target"
  ) {
    return onChannel({
      version: request.current,
      channel: request.channel,
      preRelease: {
        identifier: currentPreRelease.identifier,
        number: currentPreRelease.number + 1,
      },
    });
  }
  return onChannel({
    version: incremented({ version: request.current, size: request.size }),
    channel: request.channel,
    preRelease: {
      identifier: currentPreRelease?.identifier ?? NEW_PRE_RELEASE_IDENTIFIER,
      number: FIRST_PRE_RELEASE_NUMBER,
    },
  });
};
