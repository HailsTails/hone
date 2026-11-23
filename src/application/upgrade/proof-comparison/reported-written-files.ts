import type { RunReport } from "../../../domain/report/run-report.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";

export const reportedWrittenFilesOf = (request: {
  readonly written: readonly RepoPath[];
  readonly after: Pick<RunReport, "findings" | "answered" | "unrecorded">;
}): readonly RepoPath[] => {
  const { after } = request;
  const reported = new Set<RepoPath>([
    ...after.findings.map(({ file }) => file),
    ...after.answered.map(({ finding }) => finding.file),
    ...after.unrecorded.map((exception) =>
      exception.kind === "command-line-option" ? exception.location : exception.file,
    ),
  ]);
  return request.written.filter((file) => reported.has(file));
};
