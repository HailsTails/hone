import { describe, expect, it } from "vitest";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const entrySource = import.meta.glob(["./hone.ts"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const WIRING = `#!/usr/bin/env node
import { createDefaultExceptionRepositoryOf } from "./infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultGitPort } from "./infrastructure/git/git-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";
import { runToolCommand } from "./run-tool-command.ts";

await runToolCommand({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: import.meta.url,
});
`;

describe("tool-command.ts, read as a build-time raw module (CD-47: the entry's own source is the assertion's subject; importing it would run the command, and nothing is spawned)", () => {
  it("only awaits runToolCommand with the default port factories and its own module URL", () => {
    expect(entrySource).toEqual({ "./hone.ts": WIRING });
  });
});
