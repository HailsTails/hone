import { describe, expect, it, vi } from "vitest";

import { createRequestPort, type RequestSurface } from "./request-port.ts";

describe("createRequestPort", () => {
  it("reads the request from standard input, descriptor 0", () => {
    const readDescriptor = vi
      .fn<RequestSurface["readDescriptor"]>()
      .mockReturnValue('{"tracked":[]}');
    const requestPort = createRequestPort({ requestSurface: { readDescriptor } });

    const text = requestPort.read();

    expect({ text, calls: readDescriptor.mock.calls }).toEqual({
      text: '{"tracked":[]}',
      calls: [[{ descriptor: 0 }]],
    });
  });
});
