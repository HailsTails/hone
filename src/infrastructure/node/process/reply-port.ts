import { writeFileSync } from "node:fs";

import type { ReplyPort } from "../../../application/ports/host/reply-port.ts";
import { REPLY_PIPE_DESCRIPTOR } from "./reply-pipe.ts";

export type ReplySurface = {
  readonly writeDescriptor: (request: {
    readonly descriptor: number;
    readonly text: string;
  }) => void;
};

export const createReplyPort = (options: { readonly replySurface: ReplySurface }): ReplyPort => ({
  write: (request) => {
    options.replySurface.writeDescriptor({ descriptor: REPLY_PIPE_DESCRIPTOR, text: request.text });
  },
});

export const defaultReplySurface: ReplySurface = {
  writeDescriptor: (request) => {
    writeFileSync(request.descriptor, request.text);
  },
};

export const createDefaultReplyPort = (): ReplyPort =>
  createReplyPort({ replySurface: defaultReplySurface });
