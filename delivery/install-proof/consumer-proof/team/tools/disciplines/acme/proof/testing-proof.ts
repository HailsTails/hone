import { folderScope, isEdition, type PieceFailure, type RunnerClause, type WalkerDisk } from "@hailstails/hone/audit";
import { type CaseUnderTest, checkConformanceOf, checkUnderTestOf, clauseConformanceOf, clauseUnderTestOf, repoPathOf } from "@hailstails/hone/testing";
import typescript from "typescript";
import { check } from "../mechanisms/audit/ACME-2/scratch-files.ts";

const RULE_SET_ROOT = "tools/disciplines/acme";

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

provedEqual({
  proof: "ACME-2 reproduces its cases",
  actual: await clauseConformanceOf({ ruleSetRoot: RULE_SET_ROOT, clause: "acme/ACME-2#scratch-files" }),
  expected: { outcome: "ok", value: [] },
});
provedEqual({
  proof: "ACME-1 is not an audit clause",
  actual: await clauseConformanceOf({ ruleSetRoot: RULE_SET_ROOT, clause: "acme/ACME-1#console-calls" }),
  expected: { outcome: "failed", error: { kind: "rule-set-unloadable", detail: "mechanism-not-allowed acme/ACME-1#console-calls audit" } },
});

const classKeyword = checkUnderTestOf({ check: "authored-class-or-this#class-keyword", engine: "walker" });
if (classKeyword.outcome === "failed") {
  throw new Error(`the installed class-keyword examples could not be read: ${classKeyword.error.detail}`);
}

provedEqual({
  proof: "the installed class-keyword piece runs its named examples",
  actual: await checkConformanceOf({ check: "authored-class-or-this#class-keyword", engine: "walker" }),
  expected: { outcome: "ok", value: [] },
});

const underTest = clauseUnderTestOf({ ruleSetRoot: RULE_SET_ROOT, clause: "acme/ACME-2#scratch-files" });
if (underTest.outcome === "failed") {
  throw new Error(`ACME-2 is not under test: ${underTest.error.kind} ${underTest.error.detail}`);
}
const unreadable = repoPathOf({ file: "src/locked.ts" });
if (unreadable.outcome === "failed") {
  throw new Error(`src/locked.ts is not a repository path: ${unreadable.error.detail}`);
}
const caseFiles = underTest.value.cases.map((sourceCase) => sourceCase.file);
const prepared = check.prepare({
  clauses: [underTest.value.clause],
  repository: { files: [...caseFiles, unreadable.value], exists: ({ file }) => (caseFiles.includes(file) ? "present" : "absent"), disk: NO_DISK },
  syntaxApi: typescript,
});
if (prepared.outcome === "failed") {
  throw new Error(`ACME-2 did not prepare: ${prepared.error.kind}`);
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
  proof: "each case is bound with its file and source, and ACME-2 decides on the file name alone",
  actual: underTest.value.cases.map((sourceCase) => ({
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
  proof: "ACME-2 handles a file it cannot read",
  actual: prepared.value.prepareFile({ file: unreadable.value, readText: () => ({ outcome: "failed", error: unreadableFailure }) }),
  expected: { outcome: "ok", value: { kind: "complete", hits: [] } },
});

const SECOND_EDITION = "2";
if (!isEdition(SECOND_EDITION)) {
  throw new Error(`${SECOND_EDITION} is not an edition`);
}
const secondEditionClause: RunnerClause = { ...underTest.value.clause, edition: SECOND_EDITION };
const draftFile = repoPathOf({ file: "src/notes.draft.ts" });
if (draftFile.outcome === "failed") {
  throw new Error(`src/notes.draft.ts is not a repository path: ${draftFile.error.detail}`);
}

const draftHitsUnder = (request: { readonly clause: RunnerClause }): unknown => {
  const preparedUnder = check.prepare({
    clauses: [request.clause],
    repository: { files: [draftFile.value], exists: () => "present", disk: NO_DISK },
    syntaxApi: typescript,
  });
  if (preparedUnder.outcome === "failed") {
    throw new Error(`ACME-2 did not prepare: ${preparedUnder.error.kind}`);
  }
  return preparedUnder.value.prepareFile({ file: draftFile.value, readText: () => ({ outcome: "ok", value: "" }) });
};

provedEqual({
  proof: "ACME-2 runs its default edition, which does not flag a draft file",
  actual: { edition: underTest.value.clause.edition, result: draftHitsUnder({ clause: underTest.value.clause }) },
  expected: { edition: "1", result: { outcome: "ok", value: { kind: "complete", hits: [] } } },
});
provedEqual({
  proof: "ACME-2 edition 2 flags a draft file",
  actual: draftHitsUnder({ clause: secondEditionClause }),
  expected: {
    outcome: "ok",
    value: {
      kind: "complete",
      hits: [{ clause: underTest.value.clause.address, anchor: { line: 1, column: 0 }, snippet: "src/notes.draft.ts" }],
    },
  },
});
