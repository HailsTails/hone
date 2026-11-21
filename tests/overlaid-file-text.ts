import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";

const slashed = (text: string): string => text.replaceAll("\\", "/");

export const overlaidFileText = (request: {
  readonly base: FileTextPort;
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const overlaid = (requested: string): string | undefined =>
    Object.entries(request.files).find(([name]) => slashed(name) === slashed(requested))?.[1];
  return {
    ...request.base,
    read: (reading) => {
      const text = overlaid(reading.path);
      return text === undefined ? request.base.read(reading) : { outcome: "ok", value: text };
    },
    exists: (probing) => (overlaid(probing.path) === undefined ? request.base.exists(probing) : "present"),
  };
};

const OVERLAY_ONLY = "the in-memory overlay writes only the files it overlays";

export const inMemoryOverlay = (request: {
  readonly base: FileTextPort;
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const files = new Map(Object.entries(request.files).map(([name, text]) => [slashed(name), text]));
  return {
    read: (reading) => {
      const text = files.get(slashed(reading.path));
      return text === undefined ? request.base.read(reading) : { outcome: "ok", value: text };
    },
    exists: (probing) => (files.has(slashed(probing.path)) ? "present" : request.base.exists(probing)),
    write: (writing) => {
      if (!files.has(slashed(writing.path))) {
        return { outcome: "failed", error: { kind: "unwritable", path: writing.path, detail: OVERLAY_ONLY } };
      }
      files.set(slashed(writing.path), writing.text);
      return { outcome: "ok", value: undefined };
    },
  };
};
