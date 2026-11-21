import type { MisnamedRuleId, NonEmptyRuleIds } from "../../domain/runner/checks-run-report.ts";
import { onOneLine } from "./printed-text.ts";

const ONLY_REPLACEMENT_COUNT = 1;

export const replacementText = (request: { readonly replacedBy: NonEmptyRuleIds }): string =>
  request.replacedBy.length === ONLY_REPLACEMENT_COUNT ? request.replacedBy[0] : `each of ${request.replacedBy.join(", ")}`;

const replacementPartOf = (request: { readonly misnamed: MisnamedRuleId }): string =>
  request.misnamed.kind === "version-1-id" ? ` write ${replacementText({ replacedBy: request.misnamed.replacedBy })}` : "";

export const misnamedLine = (request: { readonly misnamed: MisnamedRuleId }): string =>
  `${request.misnamed.file}:${request.misnamed.line} ${request.misnamed.kind} ${request.misnamed.ruleId}${replacementPartOf(request)} ${onOneLine({ text: request.misnamed.text })}`;
