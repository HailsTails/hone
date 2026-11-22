import { z } from "zod";

import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { NOT_A_REPO_PATH, isRepoPath, isRepoPathText } from "../../domain/repository/repo-path.ts";
import { brandedTextSchema } from "../content-files/branded-schema.ts";
import type { Equal } from "../engines/protocol/runner-module/type-equality.ts";

export const repoPathTextSchema = z.string().superRefine((text, context) => {
  if (isRepoPathText({ text }) === "not-repo-path") {
    context.addIssue({ code: "custom", message: NOT_A_REPO_PATH });
  }
});

export const brandedRepoPathSchema = (request: { readonly text: z.ZodType<string, string> }) =>
  brandedTextSchema({ text: request.text, isBranded: isRepoPath, refusal: NOT_A_REPO_PATH });

export const repoPathSchema = brandedRepoPathSchema({ text: repoPathTextSchema });

export const isRepoPathSchemaEqual: Equal<z.output<typeof repoPathSchema>, RepoPath> = true;
