import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import { createDefaultJsoncTreePort, type JsoncNode } from "./jsonc-parse.ts";
import { folderScope } from "./source-scope.ts";
import type { WalkerFile } from "./walker-piece.ts";

export const PACKAGE_MANIFEST = /(?:^|\/)package\.json$/;
export const WORKFLOW =
  /^(?:\.github\/workflows\/.*\.ya?ml|(?<gitlab>\.gitlab-ci\.ya?ml)|azure-pipelines\.ya?ml)$/;

type ReadFile<Content> = Result<Content | undefined, PieceFailure>;

export const dependencySourceOf = (
  request: WalkerFile & {
    readonly accepts: RegExp;
  },
): ReadFile<string> =>
  request.accepts.test(request.file) && folderScope({ file: request.file }) !== "generated"
    ? request.readText()
    : { outcome: "ok", value: undefined };

const jsoncTree = createDefaultJsoncTreePort({ trailingCommas: "refused" });

const unparseableManifest = (file: WalkerFile, detail: string): ReadFile<never> => ({
  outcome: "failed",
  error: { kind: "file-unparseable", file: file.file, detail },
});

type ManifestField = {
  readonly value: unknown;
  readonly anchor: Anchor;
  readonly snippet: string;
  readonly fields: LocatedManifest;
};

type LocatedManifest = ReadonlyMap<string, ManifestField>;

type LineSearch = {
  readonly starts: readonly number[];
  readonly offset: number;
  readonly first: number;
  readonly last: number;
};

const lineIndexOf = (request: LineSearch): number => {
  const { offset, starts, first, last } = request;
  if (first === last) return first;
  const middle = Math.ceil((first + last) / 2);
  return (starts[middle] ?? 0) <= offset
    ? lineIndexOf({ ...request, first: middle })
    : lineIndexOf({ ...request, last: middle - 1 });
};

type ManifestSource = { readonly source: string; readonly starts: readonly number[] };

const propertyAnchor = (offset: number, locations: ManifestSource): Anchor => {
  const { starts } = locations;
  const line = lineIndexOf({ starts, offset, first: 0, last: starts.length - 1 });
  return { line: line + 1, column: offset - (starts[line] ?? 0) };
};

const sourceToken = (source: string, token: JsoncNode): string =>
  source.slice(token.offset, token.offset + token.length);

const locatedFieldsOf = (request: {
  readonly node: JsoncNode | undefined;
  readonly locations: ManifestSource;
}): LocatedManifest => {
  const { node, locations } = request;
  if (node?.type !== "object") return new Map();
  const { source } = locations;
  return new Map(
    node.children?.flatMap((property): readonly (readonly [string, ManifestField])[] => {
      const [key, propertyValue] = property.children ?? [];
      if (key === undefined || typeof key.value !== "string" || propertyValue === undefined)
        return [];
      const keyToken = sourceToken(source, key);
      return [
        [
          key.value,
          {
            value: propertyValue.value,
            anchor: propertyAnchor(key.offset, locations),
            snippet:
              propertyValue.type === "string"
                ? `${keyToken}: ${sourceToken(source, propertyValue)}`
                : keyToken,
            fields: locatedFieldsOf({ node: propertyValue, locations }),
          },
        ],
      ];
    }),
  );
};

export const locatedPackageManifestOf = (file: WalkerFile): ReadFile<LocatedManifest> => {
  const text = dependencySourceOf({ ...file, accepts: PACKAGE_MANIFEST });
  if (text.outcome === "failed") return text;
  if (text.value === undefined) return { outcome: "ok", value: undefined };
  const source = text.value;
  const parsed = jsoncTree.parse({ source });
  if (parsed.outcome === "failed") return unparseableManifest(file, parsed.error.detail);
  const starts = [
    0,
    ...Array.from(source.matchAll(/\r\n|\r|\n/g), ({ index, 0: ending }) => index + ending.length),
  ];
  return {
    outcome: "ok",
    value: locatedFieldsOf({ node: parsed.value, locations: { source, starts } }),
  };
};
