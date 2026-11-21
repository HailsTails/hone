import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../../../../engines/protocol/runner-module/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../../../../hone-records-folder/repo-path.ts";
import { textsDisk } from "../../../../../../engines/audit/runner/pieces/walker-disk.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../../../../../engines/audit/runner/toolchain/typescript-toolchain.ts";
import { check } from "./no-tmp-files.ts";
import { FIRST_EDITION } from "../../../../../edition.ts";

const loadedParsePort = await loadParsePort({ peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../../../../..`, installForm: "source" }) });
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const SYNTAX_API = loadedParsePort.value.syntaxApi;

const EMPTY_DISK = textsDisk({ root: "/repo", texts: {} });

const ADDRESS = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/probe/mechanisms/audit/PD-1",
  clauseSettings: {},
  edition: FIRST_EDITION,
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
