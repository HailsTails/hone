import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import { decideImport, type ImportAllowance } from "./import-allowances.ts";
import type { ModuleImport } from "./module-imports.ts";
import type { SourceImports } from "./source-imports.ts";

export type ImportBoundary = {
  readonly name: string;
  readonly holds: readonly RegExp[];
  readonly leavesOut: readonly RegExp[];
  readonly allowed: readonly ImportAllowance[];
};

export type ImportOutside = ModuleImport & { readonly boundary: string; readonly file: string };

type Confinement = {
  readonly sources: readonly SourceImports[];
  readonly boundaries: readonly ImportBoundary[];
};

const listSourcesWithin = (request: {
  readonly sources: readonly SourceImports[];
  readonly boundary: ImportBoundary;
}): readonly SourceImports[] =>
  request.sources.filter(
    ({ file }) =>
      request.boundary.holds.some((held) => held.test(file)) &&
      !request.boundary.leavesOut.some((left) => left.test(file)),
  );

export const listBoundaryFiles = (
  request: Confinement,
): readonly { readonly boundary: string; readonly files: readonly string[] }[] =>
  request.boundaries.map((boundary) => ({
    boundary: boundary.name,
    files: listSourcesWithin({ sources: request.sources, boundary }).map(({ file }) => file),
  }));

export const findImportsOutside = (
  request: Confinement & {
    readonly path: Pick<PathPort, "joinRepository" | "repositoryDirectoryOf">;
  },
): readonly ImportOutside[] => {
  const { boundaries, path, sources } = request;
  return boundaries.flatMap((boundary) =>
    listSourcesWithin({ sources, boundary }).flatMap(({ file, imports }) =>
      imports
        .filter(
          (moduleImport) =>
            decideImport({ allowed: boundary.allowed, file, moduleImport, path }) === "outside",
        )
        .map((moduleImport) => ({ boundary: boundary.name, file, ...moduleImport })),
    ),
  );
};
