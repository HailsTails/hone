import { describe, expect, it } from "vitest";
import type { Branded } from "../../domain/repository/branded.ts";
import { brandedTextSchema } from "./branded-schema.ts";
import { repoPathTextSchema } from "../hone-records-folder/repo-path.ts";

type EntryPath = Branded<string, "EntryPath">;

const ENTRY_PATH = "src/index.ts";

const isEntryPath = (text: string): text is EntryPath => text === ENTRY_PATH;

const entryPathSchema = brandedTextSchema({ text: repoPathTextSchema, isBranded: isEntryPath, refusal: "not the entry path" });

describe("brandedTextSchema", () => {
  it("brands text that passes the text schema and the brand's own test", () => {
    expect(entryPathSchema.safeParse(ENTRY_PATH)).toEqual({ success: true, data: ENTRY_PATH });
  });

  it("refuses with the brand's refusal when the text schema passes but the brand's test does not", () => {
    expect(entryPathSchema.safeParse("src/other.ts")).toMatchObject({
      success: false,
      error: { issues: [{ code: "custom", message: "not the entry path" }] },
    });
  });

  it("refuses with only the text schema's message when the text schema fails, never reaching the brand", () => {
    expect(entryPathSchema.safeParse("/src/index.ts")).toMatchObject({
      success: false,
      error: { issues: [{ code: "custom", message: "not a repo-relative path" }] },
    });
  });
});
