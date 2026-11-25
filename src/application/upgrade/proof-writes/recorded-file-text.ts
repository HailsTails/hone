import { isAbsolutePath } from "../../../domain/repository/absolute-path.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { ProofWrite } from "../../ports/upgrade/proof-outcome.ts";
import type { ProofWrites } from "./proof-writes.ts";

export type RecordedFileText = {
  readonly fileText: FileTextPort;
  readonly writes: () => ProofWrites;
};

type WriteRequest = Parameters<FileTextPort["write"]>[0];

type WriteResult = ReturnType<FileTextPort["write"]>;

const unwritable = (request: { readonly path: string; readonly detail: string }): WriteResult => ({
  outcome: "failed",
  error: { kind: "unwritable", path: request.path, detail: request.detail },
});

export const createRecordedFileText = (request: {
  readonly fileText: FileTextPort;
}): RecordedFileText => {
  const { fileText } = request;
  const recorded: ProofWrite[] = [];
  const write = ({ path, text }: WriteRequest): WriteResult => {
    if (!isAbsolutePath(path)) {
      return unwritable({ path, detail: `${path} is not an absolute path` });
    }
    if (fileText.exists({ path }) === "absent") {
      const created = fileText.write({ path, text });
      if (created.outcome === "ok" || fileText.exists({ path }) === "present") {
        recorded.push({ kind: "file-created", path });
      }
      return created;
    }
    const original = fileText.read({ path });
    if (original.outcome === "failed") {
      return unwritable({ path, detail: original.error.detail });
    }
    recorded.push({ kind: "file-replaced", path, original: original.value });
    return fileText.write({ path, text });
  };
  return {
    fileText: { read: fileText.read, exists: fileText.exists, write },
    writes: () => [...recorded],
  };
};
