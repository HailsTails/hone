import type {
  ExceptionRepository,
  FoundTreeExceptions,
} from "../../ports/records/exception-repository.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";

type EntriesReach = Pick<ExceptionRepository, "read" | "readAt">;

export const foundTreeExceptionsOf = (request: {
  readonly repository: EntriesReach;
  readonly loadFailureDetail: LoadFailureDetail;
}): Pick<ExceptionRepository, "read"> & FoundTreeExceptions => ({
  read: request.repository.read,
  readAt: () => {
    const read = request.repository.read();
    return read.outcome === "ok"
      ? { outcome: "ok", value: read.value.map(({ entry }) => entry) }
      : {
          outcome: "failed",
          error: {
            kind: "git-failed",
            command: "read the tree the upgrade found",
            detail: request.loadFailureDetail({ failure: read.error }),
          },
        };
  },
});
