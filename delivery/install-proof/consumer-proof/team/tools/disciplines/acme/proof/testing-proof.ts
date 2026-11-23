import { folderScope, isEdition, type PieceFailure, type CheckBinding, type WalkerDisk } from "@hailstails/hone/audit";
import { type CaseUnderTest, checkConformanceOf, checkUnderTestOf, repoPathOf } from "@hailstails/hone/testing";
import typescript from "typescript";
import { check } from "../engines/walker/scratch-file/scratch-files/scratch-files.ts";

import scratchCases from "../engines/walker/scratch-file/scratch-files/scratch-files.examples.json" with { type: "json" };

const NO_DISK: WalkerDisk = {
  root: "/repository",
  kindAt: () => "absent",
  textAt: ({ path }) => ({ outcome: "failed", error: { detail: `${path} is not on this disk` } }),
};

const provedEqual = (request: { readonly proof: string; readonly actual: unknown; readonly expected: unknown }): void => {
  if (JSON.stringify(request.actual) !== JSON.stringify(request.expected)) {
    throw new Error(`${request.proof}: expected ${JSON.stringify(request.expected)}, but got ${JSON.stringify(request.actual)}`);
  }
};

provedEqual({ proof: "a dependency folder is generated", actual: folderScope({ file: "node_modules/acme/index.js" }), expected: "generated" });
provedEqual({ proof: "a source file is authored", actual: folderScope({ file: "src/kept.ts" }), expected: "authored" });

const classKeyword = checkUnderTestOf({ check: "authored-class-or-this#class-keyword", engine: "walker" });
if (classKeyword.outcome === "failed") {
  throw new Error(`the installed class-keyword examples could not be read: ${classKeyword.error.detail}`);
}

provedEqual({
  proof: "the installed class-keyword piece runs its named examples",
  actual: await checkConformanceOf({ check: "authored-class-or-this#class-keyword", engine: "walker" }),
  expected: { outcome: "ok", value: [] },
});

const FIRST_EDITION = "1";
if (!isEdition(FIRST_EDITION)) {
  throw new Error("The default edition is invalid");
}
const examples = [...scratchCases.flag, ...scratchCases.allow].map((sourceCase): CaseUnderTest => {
  const file = repoPathOf({ file: sourceCase.fileName });
  const edition = "edition" in sourceCase ? sourceCase.edition : FIRST_EDITION;
  if (file.outcome === "failed" || typeof edition !== "string" || !isEdition(edition)) {
    throw new Error(`The installed fixture is invalid: ${sourceCase.name}`);
  }
  return { name: sourceCase.name, file: file.value, source: sourceCase.source, edition };
});
const binding: CheckBinding = {
  address: "scratch-file#scratch-files",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: "tools/disciplines/acme/engines/walker/scratch-file/scratch-files",
  settings: { module: "scratch-files.ts" },
  checkSettings: {},
  edition: FIRST_EDITION,
};
const unreadable = repoPathOf({ file: "src/locked.ts" });
if (unreadable.outcome === "failed") {
  throw new Error(`src/locked.ts is not a repository path: ${unreadable.error.detail}`);
}
const caseFiles = examples.map((sourceCase) => sourceCase.file);
const prepared = check.prepare({
  bindings: [binding],
  repository: { files: [...caseFiles, unreadable.value], exists: ({ file }) => (caseFiles.includes(file) ? "present" : "absent"), disk: NO_DISK },
  syntaxApi: typescript,
});
if (prepared.outcome === "failed") {
  throw new Error(`scratch-files did not prepare: ${prepared.error.kind}`);
}

const readsOf = (sourceCase: CaseUnderTest): number => {
  const reads: string[] = [];
  prepared.value.prepareFile({
    file: sourceCase.file,
    readText: () => {
      reads.push(sourceCase.name);
      return { outcome: "ok", value: sourceCase.source };
    },
  });
  return reads.length;
};

provedEqual({
  proof: "each case is bound with its file and source, and scratch-files decides on the file name alone",
  actual: examples.map((sourceCase) => ({
    name: sourceCase.name,
    file: sourceCase.file,
    edition: sourceCase.edition,
    reads: readsOf(sourceCase),
  })),
  expected: [
    { name: "scratch file", file: "src/draft.scratch.ts", edition: "1", reads: 0 },
    { name: "draft file", file: "src/notes.draft.ts", edition: "2", reads: 0 },
    { name: "ordinary file", file: "src/kept.ts", edition: "1", reads: 0 },
    { name: "draft file before edition 2", file: "src/notes.draft.ts", edition: "1", reads: 0 },
  ],
});

const unreadableFailure: PieceFailure = { kind: "file-unreadable", file: unreadable.value, detail: "EACCES" };
provedEqual({
  proof: "scratch-files handles a file it cannot read",
  actual: prepared.value.prepareFile({ file: unreadable.value, readText: () => ({ outcome: "failed", error: unreadableFailure }) }),
  expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
});

const SECOND_EDITION = "2";
if (!isEdition(SECOND_EDITION)) {
  throw new Error(`${SECOND_EDITION} is not an edition`);
}
const secondEditionBinding: CheckBinding = { ...binding, edition: SECOND_EDITION };
const draftFile = repoPathOf({ file: "src/notes.draft.ts" });
if (draftFile.outcome === "failed") {
  throw new Error(`src/notes.draft.ts is not a repository path: ${draftFile.error.detail}`);
}

const draftHitsUnder = (request: { readonly binding: CheckBinding }): unknown => {
  const preparedUnder = check.prepare({
    bindings: [request.binding],
    repository: { files: [draftFile.value], exists: () => "present", disk: NO_DISK },
    syntaxApi: typescript,
  });
  if (preparedUnder.outcome === "failed") {
    throw new Error(`scratch-files did not prepare: ${preparedUnder.error.kind}`);
  }
  return preparedUnder.value.prepareFile({ file: draftFile.value, readText: () => ({ outcome: "ok", value: "" }) });
};

provedEqual({
  proof: "scratch-files runs its default edition, which does not flag a draft file",
  actual: { edition: binding.edition, result: draftHitsUnder({ binding }) },
  expected: { edition: "1", result: { outcome: "ok", value: { kind: "complete", hits: [] } } },
});
provedEqual({
  proof: "scratch-files edition 2 flags a draft file",
  actual: draftHitsUnder({ binding: secondEditionBinding }),
  expected: {
    outcome: "ok",
    value: {
      kind: "complete",
      hits: [{ check: binding.address, anchor: { line: 1, column: 0 }, snippet: "src/notes.draft.ts" }],
    },
  },
});
