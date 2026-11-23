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
import { check } from "./committed-lock-file.ts";

const MANIFEST = repoPathSchema.parse("packages/orders/package.json");
const ADDRESS = "no-lock-file#committed-lock-file";
const BINDING: CheckBinding = {
  address: ADDRESS,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "/install/walker/no-lock-file/committed-lock-file",
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "committed-lock-file.ts" },
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
  readonly trackedLock?: RepoPath;
}): readonly CheckHit[] => {
  const files =
    request.trackedLock === undefined ? [request.file] : [request.file, request.trackedLock];
  const prepared = check.prepare({
    bindings: [BINDING],
    repository: { files, exists: () => "present", disk: textsDisk({ root: "/repo", texts: {} }) },
    syntaxApi: parse.syntaxApi,
  });
  assert(prepared.outcome === "ok");
  const observed = observeWalkerFile({
    file: { file: request.file, readText: () => ({ outcome: "ok", value: request.source }) },
    pieces: [
      {
        modulePath: "/install/walker/no-lock-file/committed-lock-file/committed-lock-file.ts",
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

describe("committed-lock-file", () => {
  it("reports a package with dependencies and no tracked lock", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{\n  "private": true,\n  "dependencies": { "some-tool": "^1.2.3", "other-tool": "latest" }\n}',
      }),
    ).toEqual([
      {
        file: MANIFEST,
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: '"dependencies"',
      },
    ]);
  });

  it("passes a manifest covered by a tracked root workspace lock", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source:
          '{ "private": true, "dependencies": { "some-tool": "1.2.3", "other-tool": "npm:@scope/tool@4.5.6" }, "scripts": { "check": "pnpm run lint" } }',
        trackedLock: repoPathSchema.parse("pnpm-lock.yaml"),
      }),
    ).toEqual([]);
  });

  it("anchors a missing lock to non-empty dev dependencies when dependencies is empty", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{\n  "dependencies": {},\n  "devDependencies": { "some-tool": "1.2.3" }\n}',
      }),
    ).toEqual([
      {
        file: MANIFEST,
        check: ADDRESS,
        anchor: { line: 3, column: 2 },
        snippet: '"devDependencies"',
      },
    ]);
  });

  it("passes peer ranges without requiring a lock", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{ "peerDependencies": { "react": "^19.0.0" } }',
      }),
    ).toEqual([]);
  });

  const missingLock = [
    { file: MANIFEST, check: ADDRESS, anchor: { line: 1, column: 2 }, snippet: '"dependencies"' },
  ];
  it.each([
    { path: "packages/pnpm-lock.yaml", expected: [] },
    { path: "packages/orders/package-lock.json", expected: [] },
    { path: "packages/order/pnpm-lock.yaml", expected: missingLock },
    { path: "packages/orders/tools/pnpm-lock.yaml", expected: missingLock },
  ])("applies ancestry for a lock at $path", ({ path, expected }) => {
    const findings = findingsIn({
      file: MANIFEST,
      source: '{ "dependencies": { "some-tool": "1.2.3" } }',
      trackedLock: repoPathSchema.parse(path),
    });

    expect(findings).toEqual(expected);
  });

  it("passes a published dependency range when a lock is tracked", () => {
    expect(
      findingsIn({
        file: MANIFEST,
        source: '{ "dependencies": { "react": "^19.0.0" } }',
        trackedLock: repoPathSchema.parse("pnpm-lock.yaml"),
      }),
    ).toEqual([]);
  });
});
