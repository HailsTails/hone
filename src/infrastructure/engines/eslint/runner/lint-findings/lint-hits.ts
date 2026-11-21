import type { RunnerFailure } from "../../../../../application/ports/runner-failure.ts";
import type { Hit, InlineReach, NativeException } from "../../../protocol/runner-module/runner-result-schema.ts";
import type { ClauseAddress } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../../domain/result.ts";
import { CUT_MARK, SNIPPET_LIMIT } from "../../../protocol/runner-module/snippet.ts";
import { commentValueOf } from "./checks-comment-value.ts";
import { INLINE_CONFIG_RULE_ID, type LintedMessage } from "../toolchain/eslint-instance.ts";
import { parseInlineConfigComment } from "../native-exceptions/inline-config-parser.ts";

export type LintedClause = { readonly ruleId: string; readonly clause: { readonly address: ClauseAddress } };

export type RuleHit = { readonly clause: ClauseAddress; readonly line: number; readonly column: number };

export type MessageReading = {
  readonly ruleHits: readonly RuleHit[];
  readonly nativeExceptions: readonly NativeException[];
};

type Outcome<Value> = Result<Value, RunnerFailure>;

const INLINE_DISABLE = "inline-disable";

const INLINE_RULE_CONFIG = "inline-rule-config";

type InlineReading = { readonly clauses: readonly LintedClause[]; readonly reach: InlineReach };

const namedClauses = (request: {
  readonly ruleIds: readonly string[];
  readonly selected: readonly LintedClause[];
}): InlineReading => ({
  clauses: request.selected.filter((entry) => request.ruleIds.includes(entry.ruleId)),
  reach: "one-clause",
});

const inlineReadingOf = (request: {
  readonly text: string;
  readonly selected: readonly LintedClause[];
}): InlineReading => {
  const parsed = parseInlineConfigComment({ text: commentValueOf({ text: request.text }) });
  switch (parsed.kind) {
    case "disable":
      return parsed.ruleIds.length === 0
        ? { clauses: request.selected, reach: "every-selected-clause" }
        : namedClauses({ ruleIds: parsed.ruleIds, selected: request.selected });
    case "rule-config":
      return namedClauses({ ruleIds: parsed.ruleIds, selected: request.selected });
    case "unparseable-rule-config":
      return { clauses: request.selected, reach: "every-selected-clause" };
    case "not-an-exception":
      return { clauses: [], reach: "one-clause" };
  }
};

const inlineNativeException = (request: {
  readonly kind: typeof INLINE_DISABLE | typeof INLINE_RULE_CONFIG;
  readonly reach: InlineReach;
  readonly clause: LintedClause;
  readonly file: RepoPath;
  readonly message: LintedMessage;
}): NativeException => {
  const located = { clause: request.clause.clause.address, file: request.file, line: request.message.line, text: request.message.message };
  switch (request.kind) {
    case INLINE_DISABLE:
      return { kind: request.kind, ...located, reach: request.reach };
    case INLINE_RULE_CONFIG:
      return { kind: request.kind, ...located };
  }
};

const inlineExceptionKindOf = (request: {
  readonly messageId: string | undefined;
}): typeof INLINE_DISABLE | typeof INLINE_RULE_CONFIG | "not-inline" =>
  request.messageId === INLINE_DISABLE || request.messageId === INLINE_RULE_CONFIG
    ? request.messageId
    : "not-inline";

const inlineException = (request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly LintedClause[];
}): Outcome<readonly NativeException[]> => {
  const message = request.message;
  const kind = inlineExceptionKindOf({ messageId: message.messageId });
  if (kind === "not-inline") {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.file}: ${message.message}` },
    };
  }
  const reading = inlineReadingOf({ text: message.message, selected: request.selected });
  return {
    outcome: "ok",
    value: reading.clauses.map((clause) =>
      inlineNativeException({ kind, reach: reading.reach, clause, file: request.file, message }),
    ),
  };
};

const messageReadings = (request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly LintedClause[];
}): Outcome<readonly MessageReading[]> => {
  if (request.message.ruleId === INLINE_CONFIG_RULE_ID) {
    const nativeExceptions = inlineException(request);
    return nativeExceptions.outcome === "failed"
      ? nativeExceptions
      : { outcome: "ok", value: [{ ruleHits: [], nativeExceptions: nativeExceptions.value }] };
  }
  const clause = request.selected.find((entry) => entry.ruleId === request.message.ruleId);
  if (clause === undefined) {
    return { outcome: "ok", value: [] };
  }
  return {
    outcome: "ok",
    value: [
      {
        ruleHits: [{ clause: clause.clause.address, line: request.message.line, column: request.message.column }],
        nativeExceptions: [],
      },
    ],
  };
};

export const messageReadingOf = (request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly selected: readonly LintedClause[];
}): Outcome<MessageReading> => {
  const readings = gatheredOutcomes({
    outcomes: request.messages.map((message) =>
      messageReadings({ message, file: request.file, selected: request.selected }),
    ),
  });
  return readings.outcome === "failed"
    ? readings
    : {
        outcome: "ok",
        value: {
          ruleHits: readings.value.flatMap((reading) => reading.ruleHits),
          nativeExceptions: readings.value.flatMap((reading) => reading.nativeExceptions),
        },
      };
};

export const lineSnippet = (request: { readonly line: string; readonly column: number }): string => {
  const trimmed = request.line.trim();
  return trimmed.length > SNIPPET_LIMIT ? `${CUT_MARK}${request.line.slice(request.column - 1)}` : trimmed;
};

export const hitsCutFrom = (request: {
  readonly file: RepoPath;
  readonly ruleHits: readonly RuleHit[];
  readonly lines: readonly string[];
}): readonly Hit[] =>
  request.ruleHits.map((ruleHit) => ({
    clause: ruleHit.clause,
    file: request.file,
    anchor: { line: ruleHit.line, column: ruleHit.column - 1 },
    snippet: lineSnippet({ line: request.lines[ruleHit.line - 1] ?? "", column: ruleHit.column }),
  }));
