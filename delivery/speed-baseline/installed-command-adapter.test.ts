import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createInstalledCommandPort } from "./installed-command-adapter.ts";

describe("createInstalledCommandPort read", () => {
  it("reads the hone command beside the installed manifest that names it", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: '{"bin":{"hone":"src/hone.js"}}' });
    const installedCommands = createInstalledCommandPort({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      fileText: { read },
    });

    const command = installedCommands.read({
      manifest: "/work/head/node_modules/.pnpm/hone/node_modules/@hailstails/hone/package.json",
    });

    expect({ command, read: read.mock.calls }).toEqual({
      command: {
        outcome: "ok",
        value: "/work/head/node_modules/.pnpm/hone/node_modules/@hailstails/hone/src/hone.js",
      },
      read: [
        [{ path: "/work/head/node_modules/.pnpm/hone/node_modules/@hailstails/hone/package.json" }],
      ],
    });
  });

  it("names the manifest when it names no hone command", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: '{"bin":{}}' });
    const installedCommands = createInstalledCommandPort({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      fileText: { read },
    });

    const command = installedCommands.read({ manifest: "/work/head/hone/package.json" });

    expect(command).toEqual({
      outcome: "failed",
      error: { kind: "installed-command-unnamed", manifest: "/work/head/hone/package.json" },
    });
  });

  it("carries the read failure when the manifest cannot be read", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unreadable", path: "/work/head/hone/package.json", detail: "ENOENT" },
    });
    const installedCommands = createInstalledCommandPort({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
      fileText: { read },
    });

    const command = installedCommands.read({ manifest: "/work/head/hone/package.json" });

    expect(command).toEqual({
      outcome: "failed",
      error: { kind: "installed-manifest-unread", detail: "ENOENT" },
    });
  });
});
