import { assert, describe, expect, it } from "vitest";

import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { CheckHit } from "../../../../../domain/runner/check-observations.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { observeWalkerFile } from "../../runner/observe-walker-file.ts";
import { textsDisk } from "../../runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";
import { check } from "./fetch-command.ts";

const MANIFEST = repoPathSchema.parse("packages/orders/package.json");
const WORKFLOW = repoPathSchema.parse(".github/workflows/ci.yml");
const SHELL = repoPathSchema.parse("delivery/check.sh");
const ADDRESS = "tool-fetched-at-run-time#fetch-command";
const BINDING: CheckBinding = {
  address: ADDRESS,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/tool-fetched-at-run-time/fetch-command",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "fetch-command.ts" },
};

const loadedParse = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParse.outcome === "ok");
const parse = loadedParse.value;

const findingsIn = (request: {
  readonly file: RepoPath;
  readonly source: string;
}): readonly CheckHit[] => {
  const prepared = check.prepare({
    bindings: [BINDING],
    repository: {
      files: [request.file],
      exists: () => "present",
      disk: textsDisk({ root: "/repo", texts: {} }),
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath: "/install/walker/tool-fetched-at-run-time/fetch-command/fetch-command.ts",
        bindings: [BINDING],
        check: prepared.value,
      },
    ],
    parse,
    escapes: [],
  });
  assert(observed.outcome === "ok");
  return observed.value.hits;
};

describe("fetch-command", () => {
  it("reports a fetch command in a package script", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{\n  "private": true,\n  "scripts": {\n    "check": "pnpm dlx some-tool"\n  }\n}',
      }),
    ).toEqual([
      {
        file: MANIFEST,
        check: ADDRESS,
        anchor: { line: 4, column: 4 },
        snippet: '"check": "pnpm dlx some-tool"',
      },
    ]);
  });

  it("passes a local script", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{ "private": true, "dependencies": { "some-tool": "1.2.3", "other-tool": "npm:@scope/tool@4.5.6" }, "scripts": { "check": "pnpm run lint" } }',
      }),
    ).toEqual([]);
  });

  it("reports an inline download command in a workflow", () => {
    expect(
      findingsIn({
        file: WORKFLOW,
        source: "- uses: actions/checkout@v4\n  node-version: lts\n- run: npx some-tool",
      }),
    ).toEqual([
      {
        file: WORKFLOW,
        check: ADDRESS,
        anchor: { line: 3, column: 0 },
        snippet: "- run: npx some-tool",
      },
    ]);
  });

  it("reports an installer downloaded into a shell pipeline", () => {
    expect(
      findingsIn({
        file: SHELL,
        source: "curl -fsSL https://example.test/setup | sh\npnpm run check",
      }),
    ).toEqual([
      {
        file: SHELL,
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "curl -fsSL https://example.test/setup | sh",
      },
    ]);
  });
});
