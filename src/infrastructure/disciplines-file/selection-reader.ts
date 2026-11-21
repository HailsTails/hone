import type { LoadFailure } from "../command-line/load-failure.ts";
import type { FileTextPort } from "../node/file-system/file-text-port.ts";
import type { PathPort } from "../node/path-port.ts";
import { readVersionOneJson } from "../content-files/rule-sets/rule-set-reader.ts";
import type { AbsolutePath } from "../content-files/absolute-path.ts";
import type { Result } from "../../domain/result.ts";
import { type ConsumerSelectionFile, selectionFileOf } from "./selection-file.ts";

export const selectionFilePathOf = (request: { readonly path: PathPort; readonly repoRoot: AbsolutePath }): string =>
  request.path.join({ segments: [request.repoRoot, "disciplines.json"] });

export const readSelectionFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<ConsumerSelectionFile, LoadFailure> => {
  const document = readVersionOneJson(request);
  return document.outcome === "failed" ? document : selectionFileOf({ document: document.value, path: request.path });
};
