import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type {
  FileMention,
  UnreadFile,
  VersionOneMentions,
} from "../../ports/upgrade/upgrade-mentions.ts";

const VERSION_ONE_NAME_FRAGMENTS = [
  "disciplines.json",
  "discipline-exceptions",
  "disciplines.eslint.",
  "disciplines.assessment.md",
] as const;

const NUL = "\u0000";

type Content = "text" | "binary";

const contentOf = (request: { readonly text: string }): Content =>
  request.text.includes(NUL) ? "binary" : "text";

const namesVersionOneFile = (request: { readonly line: string }): "names" | "does-not-name" =>
  VERSION_ONE_NAME_FRAGMENTS.some((name) => request.line.includes(name))
    ? "names"
    : "does-not-name";

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

type FileRead =
  | { readonly outcome: "mentions"; readonly mentions: readonly FileMention[] }
  | { readonly outcome: "unread"; readonly unread: UnreadFile }
  | { readonly outcome: "removed" };

const readOf = (request: {
  readonly file: RepoPath;
  readonly removed: readonly AbsolutePath[];
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
}): FileRead => {
  const { file, removed } = request;
  const absolute = request.path.join({ segments: [request.repoRoot, file] });
  if (removed.some((target) => target === absolute)) {
    return { outcome: "removed" };
  }
  const read = request.fileText.read({ path: absolute });
  return read.outcome === "ok"
    ? { outcome: "mentions", mentions: mentionsInText({ file, text: read.value }) }
    : { outcome: "unread", unread: { file, detail: read.error.detail } };
};

export const versionOneMentionsOf = (request: {
  readonly tracked: readonly RepoPath[];
  readonly removed: readonly AbsolutePath[];
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read">;
  readonly path: Pick<PathPort, "join">;
}): VersionOneMentions => {
  const reads = request.tracked.map((file) => readOf({ ...request, file }));
  return {
    mentions: reads.flatMap((read) => (read.outcome === "mentions" ? read.mentions : [])),
    unread: reads.flatMap((read) => (read.outcome === "unread" ? [read.unread] : [])),
  };
};
