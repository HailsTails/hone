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
import { check } from "./version-selector.ts";

const MANIFEST = repoPathSchema.parse("packages/orders/package.json");
const WORKFLOW = repoPathSchema.parse(".github/workflows/ci.yml");
const ADDRESS = "floating-version#version-selector";
const BINDING: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/floating-version/version-selector",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "version-selector.ts" },
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
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath: "/install/walker/floating-version/version-selector/version-selector.ts",
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

describe("version-selector", () => {
  it("reports private runtime dependency ranges and tags", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{\n  "private": true,\n  "dependencies": {\n    "some-tool": "^1.2.3",\n    "other-tool": "latest"\n  }\n}',
      }),
    ).toEqual([
      {
        file: MANIFEST,
        check: ADDRESS,
        anchor: { line: 4, column: 4 },
        snippet: '"some-tool": "^1.2.3"',
      },
      {
        file: MANIFEST,
        check: ADDRESS,
        anchor: { line: 5, column: 4 },
        snippet: '"other-tool": "latest"',
      },
    ]);
  });

  it("passes exact versions", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{ "private": true, "dependencies": { "some-tool": "1.2.3", "other-tool": "npm:@scope/tool@4.5.6" }, "scripts": { "check": "pnpm run lint" } }',
      }),
    ).toEqual([]);
  });

  it("passes local references, commit pins and prerelease versions", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{"devDependencies":{"local":"file:../local","link":"link:../tool","workspace":"workspace:*","git":"git+https://example.test/tool#0123456789abcdef0123456789abcdef01234567","preview":"v1.2.3-rc.1+build","equal":"=1.2.3"}}',
      }),
    ).toEqual([]);
  });

  it("passes peer ranges", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{ "peerDependencies": { "react": "^19.0.0" } }',
      }),
    ).toEqual([]);
  });

  it("passes a published dependency range", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{ "dependencies": { "react": "^19.0.0" } }',
      }),
    ).toEqual([]);
  });

  it("flags a package manager major selector", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{\n  "packageManager": "pnpm@10"\n}',
      }),
    ).toEqual([
      {
        file: MANIFEST,
        check: ADDRESS,
        anchor: { line: 2, column: 2 },
        snippet: '"packageManager": "pnpm@10"',
      },
    ]);
  });

  it("passes an exact package manager version with a hash suffix", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{ "packageManager": "pnpm@10.34.9+sha512.0123456789abcdef" }',
      }),
    ).toEqual([]);
  });

  it("reports a workflow action tag and runtime selector", () => {
    expect(
      findingsIn({
        file: WORKFLOW,
        source: "- uses: actions/checkout@v4\n  node-version: lts\n- run: npx some-tool",
      }),
    ).toEqual([
      {
        file: WORKFLOW,
        check: ADDRESS,
        anchor: { line: 1, column: 0 },
        snippet: "- uses: actions/checkout@v4",
      },
      {
        file: WORKFLOW,
        check: ADDRESS,
        anchor: { line: 2, column: 0 },
        snippet: "node-version: lts",
      },
    ]);
  });

  it("passes an action commit and exact runtime while leaving matrix interpolation to review", () => {
    expect(
      findingsIn({
        file: WORKFLOW,
        source:
          "- uses: actions/checkout@0123456789abcdef0123456789abcdef01234567\n  node-version: '22.18.0'\n  python-version: \u0024{{ matrix.python }}",
      }),
    ).toEqual([]);
  });
});
