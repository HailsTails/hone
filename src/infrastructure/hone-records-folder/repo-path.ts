import { z } from "zod";
import { brandedTextSchema } from "../content-files/branded-schema.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export type { RepoPath } from "../../domain/repository/repo-path-types.ts";

export type RepoPathVerdict = "repo-path" | "not-repo-path";

const UNWALKABLE_SEGMENTS: readonly string[] = ["", ".", ".."];

const LEADING_DRIVE_LETTER = /^[A-Za-z]:/;

const LINE_BREAK_OR_NUL = /[\n\r\0]/;

const NOT_A_REPO_PATH = "not a repo-relative path";

export const isRepoPathText = (request: { readonly text: string }): RepoPathVerdict =>
  !request.text.startsWith("/") &&
  !LEADING_DRIVE_LETTER.test(request.text) &&
  !request.text.includes("\\") &&
  !LINE_BREAK_OR_NUL.test(request.text) &&
  request.text.split("/").every((segment) => !UNWALKABLE_SEGMENTS.includes(segment))
    ? "repo-path"
    : "not-repo-path";

const isRepoPath = (text: string): text is RepoPath => isRepoPathText({ text }) === "repo-path";

export const repoPathTextSchema = z.string().superRefine((text, context) => {
  if (isRepoPathText({ text }) === "not-repo-path") {
    context.addIssue({ code: "custom", message: NOT_A_REPO_PATH });
  }
});

export const brandedRepoPathSchema = (request: { readonly text: z.ZodType<string, string> }) =>
  brandedTextSchema({ text: request.text, isBranded: isRepoPath, refusal: NOT_A_REPO_PATH });

export const repoPathSchema = brandedRepoPathSchema({ text: repoPathTextSchema });

export const isRepoPathSchemaEqual: Equal<z.output<typeof repoPathSchema>, RepoPath> = true;
