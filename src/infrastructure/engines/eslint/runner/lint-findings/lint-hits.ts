import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import type {
  CheckHit,
  CheckNativeException,
} from "../../../../../domain/runner/check-observations.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { Hit, NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import { CUT_MARK, SNIPPET_LIMIT } from "../../../protocol/runner-module/snippet.ts";
import { parseInlineConfigComment } from "../native-exceptions/inline-config-parser.ts";
import { INLINE_CONFIG_RULE_ID, type LintedMessage } from "../toolchain/eslint-instance.ts";
import { commentValueOf } from "./checks-comment-value.ts";

export type LintedClause = {
  readonly ruleId: string;
  readonly clause: { readonly address: ClauseAddress };
};

export type RuleHit = {
  readonly clause: ClauseAddress;
  readonly line: number;
  readonly column: number;
};

export type MessageReading = {
  readonly ruleHits: readonly RuleHit[];
  readonly nativeExceptions: readonly NativeException[];
};

type Outcome<Value> = Result<Value, RunnerFailure>;

const INLINE_DISABLE = "inline-disable";

const INLINE_RULE_CONFIG = "inline-rule-config";

type RuleTarget<Identity> = { readonly ruleId: string; readonly identity: Identity };
type RuleLocation = { readonly line: number; readonly column: number };
type LocatedRule<Identity> = RuleLocation & { readonly identity: Identity };

type InlineLocation<Identity> = {
  readonly identity: Identity;
  readonly file: RepoPath;
  readonly line: number;
  readonly text: string;
};

type InlineRule<Identity> = InlineLocation<Identity> &
  (
    | { readonly kind: typeof INLINE_DISABLE; readonly reach: "selected-rule" | "all-rules" }
    | { readonly kind: typeof INLINE_RULE_CONFIG }
  );

type RuleReading<Identity> = {
  readonly ruleHits: readonly LocatedRule<Identity>[];
  readonly nativeExceptions: readonly InlineRule<Identity>[];
};

type InlineReading<Identity> = {
  readonly rules: readonly RuleTarget<Identity>[];
  readonly reach: "selected-rule" | "all-rules";
};

const namedRules = <Identity>(request: {
  readonly ruleIds: readonly string[];
  readonly selected: readonly RuleTarget<Identity>[];
}): InlineReading<Identity> => ({
  rules: request.selected.filter((entry) => request.ruleIds.includes(entry.ruleId)),
  reach: "selected-rule",
});

const inlineReadingOf = <Identity>(request: {
  readonly text: string;
  readonly selected: readonly RuleTarget<Identity>[];
}): InlineReading<Identity> => {
  const parsed = parseInlineConfigComment({ text: commentValueOf({ text: request.text }) });
  switch (parsed.kind) {
    case "disable":
      return parsed.ruleIds.length === 0
        ? { rules: request.selected, reach: "all-rules" }
        : namedRules({ ruleIds: parsed.ruleIds, selected: request.selected });
    case "rule-config":
      return namedRules({ ruleIds: parsed.ruleIds, selected: request.selected });
    case "unparseable-rule-config":
      return { rules: request.selected, reach: "all-rules" };
    case "not-an-exception":
      return { rules: [], reach: "selected-rule" };
  }
};

const inlineNativeException = <Identity>(request: {
  readonly kind: typeof INLINE_DISABLE | typeof INLINE_RULE_CONFIG;
  readonly reach: InlineReading<Identity>["reach"];
  readonly identity: Identity;
  readonly file: RepoPath;
  readonly message: LintedMessage;
}): InlineRule<Identity> => {
  const located = {
    identity: request.identity,
    file: request.file,
    line: request.message.line,
    text: request.message.message,
  };
  return request.kind === INLINE_DISABLE
    ? { kind: request.kind, ...located, reach: request.reach }
    : { kind: request.kind, ...located };
};

const inlineExceptionKindOf = (request: {
  readonly messageId: string | undefined;
}): typeof INLINE_DISABLE | typeof INLINE_RULE_CONFIG | "not-inline" =>
  request.messageId === INLINE_DISABLE || request.messageId === INLINE_RULE_CONFIG
    ? request.messageId
    : "not-inline";

const inlineException = <Identity>(request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly RuleTarget<Identity>[];
}): Outcome<readonly InlineRule<Identity>[]> => {
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
    value: reading.rules.map(({ identity }) =>
      inlineNativeException({ kind, reach: reading.reach, identity, file: request.file, message }),
    ),
  };
};

const messageReadings = <Identity>(request: {
  readonly message: LintedMessage;
  readonly file: RepoPath;
  readonly selected: readonly RuleTarget<Identity>[];
}): Outcome<readonly RuleReading<Identity>[]> => {
  if (request.message.ruleId === INLINE_CONFIG_RULE_ID) {
    const nativeExceptions = inlineException(request);
    return nativeExceptions.outcome === "failed"
      ? nativeExceptions
      : { outcome: "ok", value: [{ ruleHits: [], nativeExceptions: nativeExceptions.value }] };
  }
  const rule = request.selected.find((entry) => entry.ruleId === request.message.ruleId);
  if (rule === undefined) {
    return { outcome: "ok", value: [] };
  }
  return {
    outcome: "ok",
    value: [
      {
        ruleHits: [
          { identity: rule.identity, line: request.message.line, column: request.message.column },
        ],
        nativeExceptions: [],
      },
    ],
  };
};

const ruleReadingOf = <Identity>(request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly selected: readonly RuleTarget<Identity>[];
}): Outcome<RuleReading<Identity>> => {
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

export const messageReadingOf = (request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly selected: readonly LintedClause[];
}): Outcome<MessageReading> => {
  const read = ruleReadingOf({
    ...request,
    selected: request.selected.map(({ ruleId, clause }) => ({ ruleId, identity: clause.address })),
  });
  if (read.outcome === "failed") return read;
  const nativeExceptions = read.value.nativeExceptions.map(
    ({ identity, ...native }): NativeException =>
      native.kind === INLINE_DISABLE
        ? {
            ...native,
            clause: identity,
            reach: native.reach === "all-rules" ? "every-selected-clause" : "one-clause",
          }
        : { ...native, clause: identity },
  );
  return {
    outcome: "ok",
    value: {
      ruleHits: read.value.ruleHits.map(({ identity, ...location }) => ({
        ...location,
        clause: identity,
      })),
      nativeExceptions,
    },
  };
};

type NamedMessageReading = {
  readonly ruleHits: readonly (RuleLocation & { readonly check: CheckAddressText })[];
  readonly nativeExceptions: readonly CheckNativeException[];
};

export const namedMessageReadingOf = (request: {
  readonly file: RepoPath;
  readonly messages: readonly LintedMessage[];
  readonly selected: readonly { readonly ruleId: string; readonly check: CheckAddressText }[];
}): Outcome<NamedMessageReading> => {
  const read = ruleReadingOf({
    ...request,
    selected: request.selected.map(({ ruleId, check }) => ({ ruleId, identity: check })),
  });
  if (read.outcome === "failed") return read;
  const nativeExceptions = read.value.nativeExceptions.map(
    ({ identity, ...native }): CheckNativeException =>
      native.kind === INLINE_DISABLE
        ? {
            ...native,
            check: identity,
            reach: native.reach === "all-rules" ? "every-selected-check" : "one-check",
          }
        : { ...native, check: identity },
  );
  return {
    outcome: "ok",
    value: {
      ruleHits: read.value.ruleHits.map(({ identity, ...location }) => ({
        ...location,
        check: identity,
      })),
      nativeExceptions,
    },
  };
};

export const lineSnippet = (request: {
  readonly line: string;
  readonly column: number;
}): string => {
  const trimmed = request.line.trim();
  return trimmed.length > SNIPPET_LIMIT
    ? `${CUT_MARK}${request.line.slice(request.column - 1)}`
    : trimmed;
};

const anchoredHit = (request: {
  readonly file: RepoPath;
  readonly location: RuleLocation;
  readonly lines: readonly string[];
}) => ({
  file: request.file,
  anchor: { line: request.location.line, column: request.location.column - 1 },
  snippet: lineSnippet({
    line: request.lines[request.location.line - 1] ?? "",
    column: request.location.column,
  }),
});

export const hitsCutFrom = (request: {
  readonly file: RepoPath;
  readonly ruleHits: readonly RuleHit[];
  readonly lines: readonly string[];
}): readonly Hit[] =>
  request.ruleHits.map(({ clause, ...location }) => ({
    ...anchoredHit({ ...request, location }),
    clause,
  }));

export const namedHitsCutFrom = (request: {
  readonly file: RepoPath;
  readonly ruleHits: NamedMessageReading["ruleHits"];
  readonly lines: readonly string[];
}): readonly CheckHit[] =>
  request.ruleHits.map(({ check, ...location }) => ({
    ...anchoredHit({ ...request, location }),
    check,
  }));
