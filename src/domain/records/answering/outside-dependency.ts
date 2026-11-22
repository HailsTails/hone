import type { NamedBan } from "../../language-layer/symptom-catalogue.ts";

export type BanStanding = "banned" | "not-banned";

const NPM_PREFIX = "npm:";

const SCOPE_MARK = "@";

const VERSION_MARK = "@";

const SCOPED_NAME_SEGMENTS = 2;

const UNSCOPED_NAME_SEGMENTS = 1;

const withoutNpmPrefix = (request: { readonly specifier: string }): string =>
  request.specifier.startsWith(NPM_PREFIX)
    ? request.specifier.slice(NPM_PREFIX.length)
    : request.specifier;

const withoutVersion = (request: { readonly segment: string }): string => {
  const versionAt = request.segment.indexOf(VERSION_MARK);
  return versionAt === -1 ? request.segment : request.segment.slice(0, versionAt);
};

export const dependencyOf = (request: { readonly specifier: string }): string => {
  const bare = withoutNpmPrefix(request);
  const nameSegments = bare.startsWith(SCOPE_MARK) ? SCOPED_NAME_SEGMENTS : UNSCOPED_NAME_SEGMENTS;
  const segments = bare.split("/");
  const scope = segments.slice(0, nameSegments - 1);
  const name = segments
    .slice(nameSegments - 1, nameSegments)
    .map((segment) => withoutVersion({ segment }));
  return [...scope, ...name].join("/");
};

export const banStandingOf = (request: {
  readonly namedBans: readonly NamedBan[];
  readonly dependency: string;
}): BanStanding =>
  request.namedBans.some(
    (ban) => ban.outsideDependency.toLowerCase() === request.dependency.toLowerCase(),
  )
    ? "banned"
    : "not-banned";
