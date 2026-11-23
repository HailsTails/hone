import { assert, describe, expect, it, vi } from "vitest";

import type { ModuleLoaderPort } from "../../../../application/ports/host/module-loader-port.ts";
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../../node/path-port.ts";
import { createImportsRewriterOf } from "./load-imports-rewriter.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const REWRITE_REQUEST = {
  text: 'import "./a.ts";\n',
  file: repoPathOf("acme/mechanisms/audit/ACME-1/scratch.ts"),
  movedTo: repoPathOf("acme/engines/walker/scratch-file/scratch-files/scratch.ts"),
  folder: repoPathOf("acme/mechanisms/audit/ACME-1"),
  moved: new Map(),
};

const rewriterLoadedBy = (load: ModuleLoaderPort["load"]) =>
  createImportsRewriterOf({
    modules: { load },
    path: PATH,
    installRoot: absoluteRootOf("/install"),
    moduleExtension: ".js",
  })();

describe("createImportsRewriterOf", () => {
  it("loads the installed walker runner's rewriter and hands back what it rewrites", async () => {
    const rewrite = vi.fn().mockReturnValue({ outcome: "ok", value: 'import "../a.ts";\n' });
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        importsRewriterOf: vi.fn().mockResolvedValue({ outcome: "ok", value: rewrite }),
      },
    });

    const rewriter = await rewriterLoadedBy(load);

    assert(rewriter.outcome === "ok");
    expect(rewriter.value(REWRITE_REQUEST)).toEqual({
      outcome: "ok",
      value: 'import "../a.ts";\n',
    });
    expect(load).toHaveBeenCalledExactlyOnceWith({
      path: "/install/src/infrastructure/engines/walker/runner/runner.js",
    });
  });

  it("gives the runner's failure to load TypeScript as the walker's load failure", async () => {
    const failure = { kind: "runner-invalid-output", detail: "typescript could not be loaded" };
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        importsRewriterOf: vi.fn().mockResolvedValue({ outcome: "failed", error: failure }),
      },
    });

    expect(await rewriterLoadedBy(load)).toEqual({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: "walker", failure },
    });
  });

  it("refuses a runner module that offers no rewriter as invalid runner output", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: {} });

    expect(await rewriterLoadedBy(load)).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "runner-invalid-output", detail: expect.any(String) },
      },
    });
  });

  it("gives a rejected load as the walker's load failure", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockRejectedValue(new Error("gone"));

    expect(await rewriterLoadedBy(load)).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: {
          kind: "runner-invalid-output",
          detail: "the runner call threw or rejected: gone",
        },
      },
    });
  });
});
