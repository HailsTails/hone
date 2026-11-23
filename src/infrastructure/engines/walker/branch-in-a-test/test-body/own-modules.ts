import { PACKAGE_MANIFEST } from "../../runner/pieces/dependency-files.ts";
import { createDefaultJsoncParsePort } from "../../runner/pieces/jsonc-parse.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import type { WalkerRepository } from "../../runner/pieces/walker-piece.ts";

export type OwnPackageNames = readonly string[];

const jsonc = createDefaultJsoncParsePort({ trailingCommas: "refused" });

const packageNameOf = (request: {
  readonly repository: WalkerRepository;
  readonly file: string;
}): string | undefined => {
  const { disk } = request.repository;
  const text = disk.textAt({ path: `${disk.root}/${request.file}` });
  if (text.outcome !== "ok") return undefined;
  const parsed = jsonc.parse({ source: text.value });
  if (parsed.outcome !== "ok") return undefined;
  const manifest = parsed.value;
  return typeof manifest === "object" &&
    manifest !== null &&
    "name" in manifest &&
    typeof manifest.name === "string"
    ? manifest.name
    : undefined;
};

export const ownPackageNamesOf = (request: {
  readonly repository: WalkerRepository;
}): OwnPackageNames =>
  request.repository.files.flatMap((file) => {
    if (!PACKAGE_MANIFEST.test(file) || folderScope({ file }) === "generated") return [];
    const name = packageNameOf({ repository: request.repository, file });
    return name === undefined ? [] : [name];
  });

export const moduleOriginOf = (request: {
  readonly specifier: string;
  readonly ownPackageNames: OwnPackageNames;
}): "own" | "outside" => {
  const { specifier, ownPackageNames } = request;
  if (specifier.startsWith(".") || specifier.startsWith("#")) return "own";
  return ownPackageNames.some((name) => specifier === name || specifier.startsWith(`${name}/`))
    ? "own"
    : "outside";
};
