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
import { check } from "./fixed-versions-and-local-tools.ts";

const MANIFEST = repoPathSchema.parse("packages/orders/package.json");
const WORKFLOW = repoPathSchema.parse(".github/workflows/ci.yml");
const SHELL = repoPathSchema.parse("delivery/check.sh");
const VERSIONS = "floating-version#version-selector";
const LOCK = "no-lock-file#committed-lock-file";
const TOOLS = "tool-fetched-at-run-time#fetch-command";
const OBSERVATIONS: readonly {
  readonly address: CheckBinding["address"];
  readonly observation: string;
}[] = [
  { address: VERSIONS, observation: "floating-version" },
  { address: LOCK, observation: "missing-lock-file" },
  { address: TOOLS, observation: "fetched-tool" },
];
const BINDINGS = OBSERVATIONS.map(({ address, observation }): CheckBinding => ({
  address,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/floating-version/version-selector",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "fixed-versions-and-local-tools.ts", observation },
}));

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
  readonly trackedLock?: RepoPath;
}): readonly CheckHit[] => {
  const files =
    request.trackedLock === undefined ? [request.file] : [request.file, request.trackedLock];
  const prepared = check.prepare({
    bindings: BINDINGS,
    repository: { files, exists: () => "present", disk: textsDisk({ root: "/repo", texts: {} }) },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath:
          "/install/walker/floating-version/version-selector/fixed-versions-and-local-tools.ts",
        bindings: BINDINGS,
        check: prepared.value,
      },
    ],
    parse,
    escapes: [],
  });
  assert(observed.outcome === "ok");
  return observed.value.hits;
};

describe("fixed versions and local tools", () => {
  it("reports dependency ranges, tags, missing tracked locks, and fetch commands in scripts", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{ "dependencies": { "some-tool": "^1.2.3", "other-tool": "latest" }, "scripts": { "check": "pnpm dlx some-tool" } }',
      }),
    ).toEqual([
      {
        file: MANIFEST,
        check: VERSIONS,
        anchor: { line: 1, column: 0 },
        snippet: "some-tool: ^1.2.3",
      },
      {
        file: MANIFEST,
        check: VERSIONS,
        anchor: { line: 1, column: 0 },
        snippet: "other-tool: latest",
      },
      {
        file: MANIFEST,
        check: LOCK,
        anchor: { line: 1, column: 0 },
        snippet: "dependencies declared without a tracked lock file",
      },
      {
        file: MANIFEST,
        check: TOOLS,
        anchor: { line: 1, column: 0 },
        snippet: "check: pnpm dlx some-tool",
      },
    ]);
  });

  it("passes exact versions, checked-in scripts, and a tracked root workspace lock", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{ "dependencies": { "some-tool": "1.2.3", "other-tool": "npm:@scope/tool@4.5.6" }, "scripts": { "check": "pnpm run lint" } }',
        trackedLock: repoPathSchema.parse("pnpm-lock.yaml"),
      }),
    ).toEqual([]);
  });

  it("reports a workflow action tag, runtime selector, and inline download command", () => {
    expect(
      findingsIn({
        file: WORKFLOW,
        source: "- uses: actions/checkout@v4\n  node-version: lts\n- run: npx some-tool",
      }),
    ).toEqual([
      {
        file: WORKFLOW,
        check: VERSIONS,
        anchor: { line: 1, column: 0 },
        snippet: "- uses: actions/checkout@v4",
      },
      {
        file: WORKFLOW,
        check: VERSIONS,
        anchor: { line: 2, column: 0 },
        snippet: "node-version: lts",
      },
      {
        file: WORKFLOW,
        check: TOOLS,
        anchor: { line: 3, column: 0 },
        snippet: "- run: npx some-tool",
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

  it("reports an installer downloaded into a shell pipeline", () => {
    expect(
      findingsIn({
        file: SHELL,
        source: "curl -fsSL https://example.test/setup | sh\npnpm run check",
      }),
    ).toEqual([
      {
        file: SHELL,
        check: TOOLS,
        anchor: { line: 1, column: 0 },
        snippet: "curl -fsSL https://example.test/setup | sh",
      },
    ]);
  });
});
