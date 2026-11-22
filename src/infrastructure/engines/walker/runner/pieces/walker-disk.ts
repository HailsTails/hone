import type { EntryKindPort } from "../../../../../application/ports/file-system/entry-kind-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { WalkerDisk } from "./walker-piece.ts";

export const CASE_ROOT = "/repository";

export const portsDisk = (request: {
  readonly root: string;
  readonly entryKind: EntryKindPort;
  readonly fileText: FileTextPort;
}): WalkerDisk => ({
  root: request.root,
  kindAt: ({ path }) => request.entryKind.kindOf({ path }),
  textAt: ({ path }) => {
    const text = request.fileText.read({ path });
    return text.outcome === "failed"
      ? { outcome: "failed", error: { detail: text.error.detail } }
      : text;
  },
});

const foldersHolding = (request: { readonly path: string }): readonly string[] => {
  const segments = request.path.split("/");
  return segments.slice(1, -1).map((_, depth) => segments.slice(0, depth + 2).join("/"));
};

export const textsDisk = (request: {
  readonly root: string;
  readonly texts: Readonly<Record<string, string>>;
}): WalkerDisk => {
  const files = new Map(
    Object.entries(request.texts).map(([file, text]) => [`${request.root}/${file}`, text]),
  );
  const folders = new Set([
    request.root,
    ...[...files.keys()].flatMap((path) => foldersHolding({ path })),
  ]);
  return {
    root: request.root,
    kindAt: ({ path }) => {
      if (files.has(path)) {
        return "file";
      }
      return folders.has(path) ? "directory" : "absent";
    },
    textAt: ({ path }) => {
      const text = files.get(path);
      return text === undefined
        ? { outcome: "failed", error: { detail: `${path} is not a file` } }
        : { outcome: "ok", value: text };
    },
  };
};
