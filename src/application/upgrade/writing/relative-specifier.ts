const SEPARATOR = "/";

const CURRENT = ".";

const PARENT = "..";

export const directoryOf = (request: { readonly file: string }): readonly string[] =>
  request.file.split(SEPARATOR).slice(0, -1);

const resolvedSegmentsOf = (request: {
  readonly held: readonly string[];
  readonly remaining: readonly string[];
}): readonly string[] | undefined => {
  const [segment, ...remaining] = request.remaining;
  if (segment === undefined) {
    return request.held;
  }
  if (segment === CURRENT) {
    return resolvedSegmentsOf({ held: request.held, remaining });
  }
  if (segment !== PARENT) {
    return resolvedSegmentsOf({ held: request.held.concat(segment), remaining });
  }
  return request.held.length === 0
    ? undefined
    : resolvedSegmentsOf({ held: request.held.slice(0, -1), remaining });
};

export const resolvedPathOf = (request: {
  readonly directory: readonly string[];
  readonly specifier: string;
}): string | undefined =>
  resolvedSegmentsOf({
    held: request.directory,
    remaining: request.specifier.split(SEPARATOR),
  })?.join(SEPARATOR);

export const relativeSpecifierOf = (request: {
  readonly directory: readonly string[];
  readonly target: string;
}): string => {
  const segments = request.target.split(SEPARATOR);
  const folders = segments.slice(0, -1);
  const mismatch = request.directory.findIndex((folder, index) => folders[index] !== folder);
  const shared = mismatch === -1 ? request.directory.length : mismatch;
  const climbs = request.directory.slice(shared).map(() => PARENT);
  return [...(climbs.length === 0 ? [CURRENT] : climbs), ...segments.slice(shared)].join(SEPARATOR);
};
