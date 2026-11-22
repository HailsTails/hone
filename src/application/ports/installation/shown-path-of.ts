import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { FileTextPort } from "../file-system/file-text-port.ts";
import type { PathPort } from "../host/path-port.ts";

export type ShownPathOf = (request: { readonly target: string }) => string;

export type ShownPathOfRepository = (request: {
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}) => ShownPathOf;
