import { describe, expect, it } from "vitest";
import { type FileRole, fileRoleOf, type ItemIdentity, identityOf } from "./item-identity.ts";

describe("fileRoleOf", () => {
  it.each<{ readonly path: string; readonly role: FileRole }>([
    { path: "principles/tests-are-ours.md", role: "item" },
    { path: "typescript/symptoms/date-used-directly/clock-sources.md", role: "item" },
    { path: "principles/README.md", role: "other" },
    { path: "typescript/symptoms/README.md", role: "other" },
    { path: "typescript/notes.txt", role: "other" },
    { path: "typescript/symptoms.json", role: "other" },
  ])("gives $path the role $role", ({ path, role }) => {
    expect(fileRoleOf({ path })).toBe(role);
  });
});

describe("identityOf", () => {
  it.each<{ readonly path: string; readonly identity: ItemIdentity }>([
    { path: "principles/tests-are-ours.md", identity: { kind: "principle", name: "tests-are-ours", within: undefined } },
    { path: "rules/written-out-answers.md", identity: { kind: "rule", name: "written-out-answers", within: undefined } },
    { path: "cases/does-one-job.md", identity: { kind: "case", name: "does-one-job", within: undefined } },
    { path: "record-kinds/debt.md", identity: { kind: "record-kind", name: "debt", within: undefined } },
    { path: "typescript/symptoms/date-used-directly.md", identity: { kind: "symptom", name: "date-used-directly", within: undefined } },
    { path: "typescript/recipes/result-union.md", identity: { kind: "recipe", name: "result-union", within: undefined } },
    { path: "typescript/symptoms/date-used-directly/clock-sources.md", identity: { kind: "check", name: "clock-sources", within: "date-used-directly" } },
    { path: "any-language/symptoms/a/b.md", identity: { kind: "check", name: "b", within: "a" } },
  ])("reads $path as a $identity.kind named by its file", ({ path, identity }) => {
    expect(identityOf({ path })).toEqual({ outcome: "ok", value: identity });
  });

  it.each<{ readonly path: string; readonly refusal: string }>([
    { path: "stray.md", refusal: "sits where no kind of item is kept" },
    { path: "notes/stray.md", refusal: "sits where no kind of item is kept" },
    { path: "engines/walker.md", refusal: "sits where no kind of item is kept" },
    { path: "clauses/CD-17/clock-sources.md", refusal: "sits where no kind of item is kept" },
    { path: "typescript/symptoms/a/b/c.md", refusal: "sits where no kind of item is kept" },
    { path: "typescript/other/a.md", refusal: "sits where no kind of item is kept" },
    { path: "principles/Not A Name.md", refusal: "Not A Name is not a lower-case hyphenated name" },
    { path: "record-kinds/lien.md", refusal: "lien is not the name of a record kind" },
    { path: "typescript/symptoms/Bad Symptom/b.md", refusal: "Bad Symptom is not a lower-case hyphenated name, and a check sits in the folder of its symptom" },
    { path: "typescript/symptoms/a/Bad Check.md", refusal: "Bad Check is not a lower-case hyphenated name" },
  ])("refuses $path: $refusal", ({ path, refusal }) => {
    expect(identityOf({ path })).toEqual({ outcome: "failed", error: { refusal } });
  });
});
