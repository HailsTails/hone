import { assert, describe, expect, it, vi } from "vitest";

import { clauseIdOf } from "../../../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../../../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../../../../../domain/rule-set/rule-set-name-of.ts";
import type { RunnerClause } from "../../../../../../../domain/runner/runner-module-types.ts";
import { textsDisk } from "../../../../../../engines/walker/runner/pieces/walker-disk.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../../../../engines/walker/runner/toolchain/typescript-toolchain.ts";
import { repoPathSchema } from "../../../../../../hone-records-folder/repo-path.ts";
import { check } from "./no-tmp-files.ts";

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
const SYNTAX_API = loadedParsePort.value.syntaxApi;

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });

const ADDRESS = {
  ruleSet: { name: ruleSetNameOf("probe") },
  discipline: disciplineIdOf("PD-1"),
  clause: clauseIdOf("no-tmp-files"),
};
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/probe/mechanisms/audit/PD-1",
  clauseSettings: {},
  edition: editionOf("1"),
  settings: { module: "no-tmp-files.ts" },
};

const fileCheckOf = (request: { readonly file: string }) => {
  const file = repoPathSchema.parse(request.file);
  const prepared = check.prepare({
    clauses: [CLAUSE],
    repository: { files: [file], exists: vi.fn().mockReturnValue("present"), disk: EMPTY_DISK },
    syntaxApi: SYNTAX_API,
  });
  assert(prepared.outcome === "ok");
  return prepared.value.prepareFile({ file, readText: vi.fn() });
};

describe("probe PD-1 no-tmp-files path check", () => {
  it("flags a file whose name ends .tmp.ts at line 1", () => {
    expect(fileCheckOf({ file: "src/scratch.tmp.ts" })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "src/scratch.tmp.ts" }],
      },
    });
  });

  it("passes an ordinary TypeScript file", () => {
    expect(fileCheckOf({ file: "src/kept.ts" })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
  });
});
