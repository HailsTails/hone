import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { FileCreationPort } from "../../../application/ports/file-system/file-creation-port.ts";
import { createFileExclusively } from "./file-system-port.ts";

export type FileCreationSurface = {
  readonly createExclusively: (request: { readonly path: AbsolutePath; readonly text: string }) => void;
};

const NAME_TAKEN_CODE = "EEXIST";

type Refusal = "name-taken" | "other";

const refusalOf = (request: { readonly thrown: unknown }): Refusal =>
  request.thrown instanceof Error && "code" in request.thrown && request.thrown.code === NAME_TAKEN_CODE ? "name-taken" : "other";

export const createFileCreationPort = (options: { readonly surface: FileCreationSurface }): FileCreationPort => ({
  createNew: (request) => {
    try {
      options.surface.createExclusively({ path: request.path, text: request.text });
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return {
        outcome: "failed",
        error:
          refusalOf({ thrown }) === "name-taken"
            ? { kind: "already-exists", path: request.path }
            : { kind: "uncreatable", path: request.path, detail: failureDetailOf({ thrown }) },
      };
    }
  },
});

export const createDefaultFileCreationPort = (_options: Record<string, never>): FileCreationPort =>
  createFileCreationPort({ surface: { createExclusively: createFileExclusively } });
