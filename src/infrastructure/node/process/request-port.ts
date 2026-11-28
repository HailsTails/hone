import { readFileSync } from "node:fs";

import type { RequestPort } from "../../../application/ports/host/request-port.ts";

const STANDARD_INPUT_DESCRIPTOR = 0;

export type RequestSurface = {
  readonly readDescriptor: (request: { readonly descriptor: number }) => string;
};

export const createRequestPort = (options: {
  readonly requestSurface: RequestSurface;
}): RequestPort => ({
  read: () => options.requestSurface.readDescriptor({ descriptor: STANDARD_INPUT_DESCRIPTOR }),
});

export const defaultRequestSurface: RequestSurface = {
  readDescriptor: (request) => readFileSync(request.descriptor, "utf8"),
};

export const createDefaultRequestPort = (): RequestPort =>
  createRequestPort({ requestSurface: defaultRequestSurface });
