import type { Result } from "../../../src/domain/result.ts";

export type LockedPackage = { readonly name: string; readonly version: string };

type Reading<Value> = Result<Value, string>;

type LockLine = { readonly indent: number; readonly key: string; readonly value: string };

type LockNode = { readonly value: string; readonly children: ReadonlyMap<string, LockNode> };

type Siblings = {
  readonly entries: readonly (readonly [string, LockNode])[];
  readonly next: number;
};

const SUPPORTED_LOCKFILE_VERSION = "9.0";

const QUOTED_LINE = /^'((?:[^']|'')*)'(?::\s*(.*))?$/;

const PLAIN_LINE = /^(.*?):(?:\s+(.*))?$/;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const LINE_BREAK = /\r?\n/;

const QUOTE = "'";

const DOUBLE_QUOTE = '"';

const ESCAPED_QUOTE = "''";

const PEER_SUFFIX_START = "(";

const NPM_ALIAS_PREFIX = "npm:";

const UNREADABLE_PREFIXES: readonly string[] = ["link:", "file:", "workspace:"];

const FLOW_STARTS: readonly string[] = ["{", "["];

const ROOT_IMPORTER = ".";

const failedReading = (request: { readonly error: string }): Reading<never> => ({
  outcome: "failed",
  error: request.error,
});

const unquoted = (request: { readonly text: string }): string =>
  request.text.length > 1 && request.text.startsWith(QUOTE) && request.text.endsWith(QUOTE)
    ? request.text.slice(1, -1).replaceAll(ESCAPED_QUOTE, QUOTE)
    : request.text;

const lockLineOf = (request: { readonly raw: string }): LockLine => {
  const content = request.raw.trimStart();
  const indent = request.raw.length - content.length;
  const quoted = QUOTED_LINE.exec(content);
  if (quoted !== null) {
    return {
      indent,
      key: quoted[1].replaceAll(ESCAPED_QUOTE, QUOTE),
      value: unquoted({ text: quoted[2] ?? "" }),
    };
  }
  const plain = PLAIN_LINE.exec(content);
  return plain === null
    ? { indent, key: content, value: "" }
    : { indent, key: plain[1], value: unquoted({ text: plain[2] ?? "" }) };
};

const siblingsFrom = (request: {
  readonly lines: readonly LockLine[];
  readonly index: number;
  readonly indent: number;
  readonly found: Siblings["entries"];
}): Siblings => {
  const line = request.lines[request.index];
  if (line === undefined || line.indent < request.indent) {
    return { entries: request.found, next: request.index };
  }
  const following = request.lines[request.index + 1];
  const nested =
    following !== undefined && following.indent > line.indent
      ? siblingsFrom({
          lines: request.lines,
          index: request.index + 1,
          indent: following.indent,
          found: [],
        })
      : { entries: [], next: request.index + 1 };
  return siblingsFrom({
    ...request,
    index: nested.next,
    found: [...request.found, [line.key, { value: line.value, children: new Map(nested.entries) }]],
  });
};

const lockTreeOf = (request: {
  readonly lockText: string;
}): Reading<ReadonlyMap<string, LockNode>> => {
  const raws = request.lockText.split(LINE_BREAK).filter((raw) => raw.trim() !== "");
  const doubleQuoted = raws.find((raw) => raw.trimStart().startsWith(DOUBLE_QUOTE));
  if (doubleQuoted !== undefined) {
    return failedReading({
      error: `the lock holds a double-quoted key, which this reader does not read: ${doubleQuoted.trim()}`,
    });
  }
  const lines = raws.map((raw) => lockLineOf({ raw }));
  return {
    outcome: "ok",
    value: new Map(siblingsFrom({ lines, index: 0, indent: 0, found: [] }).entries),
  };
};

const childOf = (request: {
  readonly node: LockNode | undefined;
  readonly key: string;
}): LockNode | undefined => request.node?.children.get(request.key);

const withoutPeerSuffix = (request: { readonly version: string }): string =>
  request.version.split(PEER_SUFFIX_START)[0];

const problemOfVersion = (request: { readonly value: string }): string | undefined => {
  const bare = withoutPeerSuffix({ version: request.value });
  if (request.value === "") {
    return "an empty version";
  }
  if (FLOW_STARTS.some((start) => request.value.startsWith(start))) {
    return "a flow value";
  }
  const unreadable = UNREADABLE_PREFIXES.find((prefix) => request.value.startsWith(prefix));
  if (unreadable !== undefined) {
    return `a ${unreadable} value`;
  }
  if (request.value.startsWith(NPM_ALIAS_PREFIX) || bare.includes("@")) {
    return "an alias";
  }
  return SEMVER.test(bare) ? undefined : "a version that is not semver";
};

const versionOf = (request: {
  readonly owner: string;
  readonly name: string;
  readonly value: string;
}): Reading<string> => {
  const problem = problemOfVersion({ value: request.value });
  if (problem === undefined) {
    return { outcome: "ok", value: request.value };
  }
  const shown = request.value === "" ? "" : `: ${request.value}`;
  return failedReading({ error: `${request.owner} holds ${problem} for ${request.name}${shown}` });
};

const allRead = <Value>(request: {
  readonly results: readonly Reading<Value>[];
}): Reading<readonly Value[]> =>
  request.results.reduce<Reading<readonly Value[]>>(
    (sofar, next) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      return next.outcome === "failed"
        ? next
        : { outcome: "ok", value: [...sofar.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

const sectionOf = (request: {
  readonly tree: ReadonlyMap<string, LockNode>;
  readonly key: string;
}): Reading<LockNode> => {
  const section = request.tree.get(request.key);
  return section === undefined
    ? failedReading({ error: `the lock holds no ${request.key} section` })
    : { outcome: "ok", value: section };
};

const rootDependenciesOf = (request: {
  readonly importers: LockNode;
  readonly dependencies: readonly string[];
}): Reading<readonly LockedPackage[]> => {
  const importer = childOf({ node: request.importers, key: ROOT_IMPORTER });
  if (importer === undefined) {
    return failedReading({ error: "the lock holds no importer for the repository root" });
  }
  const direct = childOf({ node: importer, key: "dependencies" });
  const unheld = request.dependencies.find((name) => direct?.children.get(name) === undefined);
  if (unheld !== undefined) {
    return failedReading({ error: `core depends on ${unheld}, which the lock does not hold` });
  }
  return allRead({
    results: request.dependencies.map((name): Reading<LockedPackage> => {
      const version = versionOf({
        owner: "the root importer",
        name,
        value: childOf({ node: direct?.children.get(name), key: "version" })?.value ?? "",
      });
      return version.outcome === "failed"
        ? version
        : {
            outcome: "ok",
            value: { name, version: withoutPeerSuffix({ version: version.value }) },
          };
    }),
  });
};

export const lockedDependenciesOf = (request: {
  readonly lockText: string;
  readonly dependencies: readonly string[];
}): Reading<readonly LockedPackage[]> => {
  const tree = lockTreeOf({ lockText: request.lockText });
  if (tree.outcome === "failed") {
    return tree;
  }
  const lockfileVersion = tree.value.get("lockfileVersion")?.value;
  if (lockfileVersion !== SUPPORTED_LOCKFILE_VERSION) {
    return failedReading({
      error: `the lock's lockfileVersion is ${lockfileVersion ?? "missing"}, which is not the supported ${SUPPORTED_LOCKFILE_VERSION}`,
    });
  }
  const importers = sectionOf({ tree: tree.value, key: "importers" });
  return importers.outcome === "failed"
    ? importers
    : rootDependenciesOf({ importers: importers.value, dependencies: request.dependencies });
};
