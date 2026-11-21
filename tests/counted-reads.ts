import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";

export type CountedReads = {
  readonly fileText: FileTextPort;
  readonly readsOf: (request: { readonly path: string }) => number;
};

export const countedReadsOver = (request: { readonly fileText: FileTextPort }): CountedReads => {
  const counts = new Map<string, number>();
  return {
    fileText: {
      ...request.fileText,
      read: (asked) => {
        counts.set(asked.path, (counts.get(asked.path) ?? 0) + 1);
        return request.fileText.read(asked);
      },
    },
    readsOf: ({ path }) => counts.get(path) ?? 0,
  };
};
