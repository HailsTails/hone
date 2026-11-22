import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { exclusionOf } from "../../../domain/repository/exclusion.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { FileMention } from "../../ports/upgrade/upgrade-mentions.ts";

export const VERSION_ONE_FILE_NAMES: readonly string[] = [
  "disciplines.json",
  "discipline-exceptions",
  "disciplines.eslint.mjs",
  "disciplines.assessment.md",
];

const NUL = "\u0000";

type Content = "text" | "binary";

const contentOf = (request: { readonly text: string }): Content =>
  request.text.includes(NUL) ? "binary" : "text";

const namesVersionOneFile = (request: { readonly line: string }): "names" | "does-not-name" =>
  VERSION_ONE_FILE_NAMES.some((name) => request.line.includes(name)) ? "names" : "does-not-name";

export const mentionsInText = (request: {
  readonly file: RepoPath;
  readonly text: string;
}): readonly FileMention[] =>
  contentOf({ text: request.text }) === "binary"
    ? []
    : request.text
        .split("\n")
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => namesVersionOneFile({ line }) === "names")
        .map(({ number }) => ({ file: request.file, line: number }));

export const versionOneMentionsOf = (request: {
  readonly tracked: readonly RepoPath[];
  readonly excluded: readonly RepoPath[];
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
}): readonly FileMention[] =>
  request.tracked
    .filter((file) => exclusionOf({ path: file, excluded: request.excluded }) === "checked")
    .flatMap((file) => {
      const read = request.fileText.read({
        path: request.path.join({ segments: [request.repoRoot, file] }),
      });
      return read.outcome === "ok" ? mentionsInText({ file, text: read.value }) : [];
    });
