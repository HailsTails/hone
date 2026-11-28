import type { FileRemovalPort } from "../../src/application/ports/file-system/file-removal-port.ts";
import type { IndexRemovalPort } from "./index-removal-port.ts";

export const createIndexRemovalPort = (options: {
  readonly files: FileRemovalPort;
}): IndexRemovalPort => ({
  remove: (request) => {
    const removed = options.files.remove({ path: request.index });
    return removed.outcome === "failed"
      ? {
          outcome: "failed",
          error: { kind: "index-unremoved", index: request.index, detail: removed.error.detail },
        }
      : { outcome: "ok", value: null };
  },
});
