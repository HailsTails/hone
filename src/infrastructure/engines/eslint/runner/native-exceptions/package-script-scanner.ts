import { z } from "zod";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import type { NativeException } from "../../../../../domain/runner/runner-result-types.ts";
import { parsedJson } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { packageJsonSchema } from "./eslint-file-schemas.ts";

type ClauseSubject = { readonly clause: ClauseAddress };
export type CheckSubject = { readonly check: CheckAddressText };
export type RuleSubject = ClauseSubject | CheckSubject;
export type SelectedRule = { readonly ruleId: string } & ClauseSubject;
export type ScannedRule<Subject extends RuleSubject> = {
  readonly ruleId: string;
  readonly subject: Subject;
};

export type ScriptCommand = readonly string[];

export type EslintInvocation = {
  readonly options: readonly string[];
};

export type NotPlainReason =
  | { readonly kind: "after-another-command"; readonly invocation: string }
  | { readonly kind: "wrapped"; readonly wrapper: string }
  | { readonly kind: "shell-supplied"; readonly value: string };

export type Settlement =
  | { readonly kind: "settled" }
  | { readonly kind: "unresolved" }
  | { readonly kind: "not-plain"; readonly reason: NotPlainReason };

type Expansion = "literal" | "pattern-expanded" | "shell-supplied";

type ShellToken = {
  readonly text: string;
  readonly written: string;
  readonly expansion: Expansion;
};

type SettledInvocation = EslintInvocation & {
  readonly arguments: readonly ShellToken[];
  readonly settlement: Settlement;
  readonly command: string;
};

export type ScriptOptionException<Subject extends RuleSubject = ClauseSubject> = Omit<
  Extract<NativeException, { readonly kind: "command-line-option" }>,
  "cause" | "clause" | "check"
> &
  Subject;

type ShellCommand = readonly ShellToken[];

export type OptionEffect =
  | { readonly kind: "weakens" }
  | { readonly kind: "names-config"; readonly config: string }
  | { readonly kind: "ignores-pattern"; readonly pattern: string };

export type WeakeningOption = {
  readonly option: string;
  readonly ruleIds: readonly string[];
  readonly effect: OptionEffect;
};

export type ScriptOption<Subject extends RuleSubject = ClauseSubject> = {
  readonly location: RepoPath;
  readonly effect: OptionEffect;
  readonly settlement: Settlement;
  readonly command: string;
  readonly exceptions: readonly ScriptOptionException<Subject>[];
};

export type ScriptSuppressionsLocation = {
  readonly location: RepoPath;
  readonly script: string;
};

export type UnreadableScript<Subject extends RuleSubject = ClauseSubject> = {
  readonly command: string;
  readonly exceptions: readonly ScriptOptionException<Subject>[];
};

export type PackageJsonScan<Subject extends RuleSubject = ClauseSubject> = {
  readonly scriptOptions: readonly ScriptOption<Subject>[];
  readonly suppressionsLocations: readonly ScriptSuppressionsLocation[];
  readonly unreadableScripts: readonly UnreadableScript<Subject>[];
};

type ScriptPiece =
  | { readonly kind: "quoted"; readonly token: ShellToken }
  | { readonly kind: "text"; readonly token: ShellToken }
  | { readonly kind: "operator" }
  | { readonly kind: "space" }
  | { readonly kind: "stray-quote" };

type TokenInProgress =
  | { readonly presence: "none" }
  | { readonly presence: "started"; readonly token: ShellToken };

type TokenizerState =
  | {
      readonly status: "reading";
      readonly commands: readonly ShellCommand[];
      readonly tokens: readonly ShellToken[];
      readonly token: TokenInProgress;
    }
  | { readonly status: "unterminated" };

type OptionArity = "takes-value" | "flag";

type OptionReach = "named-rules" | "every-clause";

type OptionJudgement = "weakens" | "by-config" | "by-ignore-pattern";

type WeakeningSpec = {
  readonly name: string;
  readonly arity: OptionArity;
  readonly reach: OptionReach;
  readonly judgement: OptionJudgement;
};

type OptionOccurrence = {
  readonly option: string;
  readonly optionValue: string;
  readonly valueOffset: number;
};

type LocatedWeakening = {
  readonly weakening: WeakeningOption;
  readonly valueAt: number;
  readonly optionValue: string;
};

type EslintNaming = "names-eslint" | "names-other";

type SegmentWalk =
  | { readonly position: "inside"; readonly segments: readonly string[] }
  | { readonly position: "outside" };

const SCRIPT_PIECE =
  /(?<single>'[^']*')|(?<double>"[^"]*")|(?<substitution>`[^`]*`)|(?<operator>&&|\|\||[;|()])|(?<space>\s+)|(?<text>(?:[^'"\s;|&()`$]|\$(?!\())+|[&`$])|(?<stray>['"])/y;

const SUBSTITUTION_OPENER = "$(";

const NO_SUBSTITUTION = -1;

const ESLINT_TOKEN = "eslint";

const UNREADABLE_SCRIPT_BREAKS = /[\s'";|&()]+/;

const ESLINT_VERSIONED_PREFIX = "eslint@";

const ESLINT_PATH_SUFFIXES: readonly string[] = ["/eslint", "/eslint.js"];

const FORWARDED_OPTIONS_SEPARATOR = "--";

const SHELL_SUPPLIED = /[$`]/;

const SHELL_PATTERN = /[*?[\]{}~]/;

const UNSETTLED_TEXT = /\.\.|[$`]|^[/~]|^[A-Za-z]:[\\/]/;

const PLAIN_RUNNER_TOKENS: readonly string[] = ["npx", "pnpm", "yarn", "npm", "bunx", "exec", "--"];

const ENVIRONMENT_SETTER = "cross-env";

const ENVIRONMENT_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const SUPPRESSIONS_LOCATION_OPTION = "--suppressions-location";

const RULE_VALUE_SEPARATORS = /[,:]/;

const SURROUNDING_QUOTES = /^(["'])(?<inner>.*)\1$/;

const WEAKENING_OPTIONS: readonly WeakeningSpec[] = [
  { name: "--rule", arity: "takes-value", reach: "named-rules", judgement: "weakens" },
  { name: "--suppress-rule", arity: "takes-value", reach: "named-rules", judgement: "weakens" },
  { name: "--suppress-all", arity: "flag", reach: "every-clause", judgement: "weakens" },
  {
    name: "--ignore-pattern",
    arity: "takes-value",
    reach: "every-clause",
    judgement: "by-ignore-pattern",
  },
  { name: "-c", arity: "takes-value", reach: "every-clause", judgement: "by-config" },
  { name: "--config", arity: "takes-value", reach: "every-clause", judgement: "by-config" },
  { name: "--no-config-lookup", arity: "flag", reach: "every-clause", judgement: "weakens" },
  { name: "--parser", arity: "takes-value", reach: "every-clause", judgement: "weakens" },
  { name: "--parser-options", arity: "takes-value", reach: "every-clause", judgement: "weakens" },
  { name: "--plugin", arity: "takes-value", reach: "every-clause", judgement: "weakens" },
];

const effectOf = (request: {
  readonly judgement: OptionJudgement;
  readonly optionValue: string;
}): OptionEffect => {
  switch (request.judgement) {
    case "weakens":
      return { kind: "weakens" };
    case "by-config":
      return { kind: "names-config", config: request.optionValue };
    case "by-ignore-pattern":
      return { kind: "ignores-pattern", pattern: request.optionValue };
  }
};

const doubleQuotedExpansionOf = (request: { readonly text: string }): Expansion =>
  SHELL_SUPPLIED.test(request.text) ? "shell-supplied" : "literal";

const unquotedExpansionOf = (request: { readonly text: string }): Expansion => {
  const quoted = doubleQuotedExpansionOf(request);
  return quoted === "literal" && SHELL_PATTERN.test(request.text) ? "pattern-expanded" : quoted;
};

const pieceMatchAt = (request: {
  readonly script: string;
  readonly at: number;
}): RegExpExecArray | null => {
  const pattern = new RegExp(SCRIPT_PIECE);
  pattern.lastIndex = request.at;
  return pattern.exec(request.script);
};

const substitutionEndOf = (request: {
  readonly script: string;
  readonly start: number;
}): number => {
  let depth = 0;
  let at = request.start + 1;
  while (at < request.script.length) {
    const match = pieceMatchAt({ script: request.script, at });
    if (match === null || match.groups?.stray !== undefined) {
      return NO_SUBSTITUTION;
    }
    depth += match[0] === "(" ? 1 : match[0] === ")" ? -1 : 0;
    at += match[0].length;
    if (depth === 0) {
      return at;
    }
  }
  return NO_SUBSTITUTION;
};

const scriptPieceOf = (request: { readonly match: RegExpMatchArray }): ScriptPiece => {
  const groups = request.match.groups ?? {};
  const written = request.match[0];
  if (groups.single !== undefined) {
    return {
      kind: "quoted",
      token: { text: groups.single.slice(1, -1), written, expansion: "literal" },
    };
  }
  if (groups.double !== undefined) {
    const text = groups.double.slice(1, -1);
    return {
      kind: "quoted",
      token: {
        text,
        written,
        expansion: doubleQuotedExpansionOf({ text }),
      },
    };
  }
  if (groups.substitution !== undefined) {
    return {
      kind: "text",
      token: { text: groups.substitution, written, expansion: "shell-supplied" },
    };
  }
  if (groups.operator !== undefined) {
    return { kind: "operator" };
  }
  if (groups.space !== undefined) {
    return { kind: "space" };
  }
  if (groups.text !== undefined) {
    return {
      kind: "text",
      token: {
        text: groups.text,
        written,
        expansion: unquotedExpansionOf({ text: groups.text }),
      },
    };
  }
  return { kind: "stray-quote" };
};

const tokensWithCurrent = (request: {
  readonly tokens: readonly ShellToken[];
  readonly token: TokenInProgress;
}): readonly ShellToken[] =>
  request.token.presence === "started" ? [...request.tokens, request.token.token] : request.tokens;

const joinedExpansion = (request: {
  readonly left: Expansion;
  readonly right: Expansion;
}): Expansion => {
  if (request.left === "shell-supplied" || request.right === "shell-supplied") {
    return "shell-supplied";
  }
  return request.left === "literal" ? request.right : request.left;
};

const extendedToken = (request: {
  readonly token: TokenInProgress;
  readonly piece: ShellToken;
}): TokenInProgress => ({
  presence: "started",
  token:
    request.token.presence === "started"
      ? {
          text: `${request.token.token.text}${request.piece.text}`,
          written: `${request.token.token.written}${request.piece.written}`,
          expansion: joinedExpansion({
            left: request.token.token.expansion,
            right: request.piece.expansion,
          }),
        }
      : request.piece,
});

const nextTokenizerState = (request: {
  readonly state: TokenizerState;
  readonly piece: ScriptPiece;
}): TokenizerState => {
  const state = request.state;
  if (state.status === "unterminated") {
    return state;
  }
  switch (request.piece.kind) {
    case "stray-quote":
      return { status: "unterminated" };
    case "quoted":
    case "text":
      return { ...state, token: extendedToken({ token: state.token, piece: request.piece.token }) };
    case "space":
      return {
        ...state,
        tokens: tokensWithCurrent({ tokens: state.tokens, token: state.token }),
        token: { presence: "none" },
      };
    case "operator":
      return {
        status: "reading",
        commands: [
          ...state.commands,
          tokensWithCurrent({ tokens: state.tokens, token: state.token }),
        ],
        tokens: [],
        token: { presence: "none" },
      };
  }
};

const scriptPiecesOf = (request: { readonly script: string }): readonly ScriptPiece[] => {
  const pieces: ScriptPiece[] = [];
  let at = 0;
  while (at < request.script.length) {
    const end = request.script.startsWith(SUBSTITUTION_OPENER, at)
      ? substitutionEndOf({ script: request.script, start: at })
      : NO_SUBSTITUTION;
    if (end !== NO_SUBSTITUTION) {
      const written = request.script.slice(at, end);
      pieces.push({ kind: "text", token: { text: written, written, expansion: "shell-supplied" } });
      at = end;
      continue;
    }
    const match = pieceMatchAt({ script: request.script, at });
    if (match === null) {
      return pieces;
    }
    pieces.push(scriptPieceOf({ match }));
    at += match[0].length;
  }
  return pieces;
};

const shellCommandsOf = (request: {
  readonly script: string;
}): Result<readonly ShellCommand[], { readonly kind: "unterminated-quote" }> => {
  const finalState = scriptPiecesOf(request).reduce<TokenizerState>(
    (state, piece) => nextTokenizerState({ state, piece }),
    {
      status: "reading",
      commands: [],
      tokens: [],
      token: { presence: "none" },
    },
  );
  if (finalState.status === "unterminated") {
    return { outcome: "failed", error: { kind: "unterminated-quote" } };
  }
  return {
    outcome: "ok",
    value: [
      ...finalState.commands,
      tokensWithCurrent({ tokens: finalState.tokens, token: finalState.token }),
    ].filter((command) => command.length > 0),
  };
};

const textsOf = (request: { readonly command: ShellCommand }): ScriptCommand =>
  request.command.map((token) => token.text);

export const scriptCommandsOf = (request: {
  readonly script: string;
}): Result<readonly ScriptCommand[], { readonly kind: "unterminated-quote" }> => {
  const commands = shellCommandsOf(request);
  if (commands.outcome === "failed") {
    return commands;
  }
  return { outcome: "ok", value: commands.value.map((command) => textsOf({ command })) };
};

const eslintNamingOf = (request: { readonly token: string }): EslintNaming =>
  request.token === ESLINT_TOKEN ||
  request.token.startsWith(ESLINT_VERSIONED_PREFIX) ||
  ESLINT_PATH_SUFFIXES.some((suffix) => request.token.endsWith(suffix))
    ? "names-eslint"
    : "names-other";

const invocationOf = (request: {
  readonly command: ScriptCommand;
}): readonly EslintInvocation[] => {
  const eslintIndex = request.command.findIndex(
    (token) => eslintNamingOf({ token }) === "names-eslint",
  );
  if (eslintIndex === -1) {
    return [];
  }
  return [
    {
      options: request.command
        .slice(eslintIndex + 1)
        .filter((token) => token !== FORWARDED_OPTIONS_SEPARATOR),
    },
  ];
};

export const eslintInvocationsOf = (request: {
  readonly commands: readonly ScriptCommand[];
}): readonly EslintInvocation[] => request.commands.flatMap((command) => invocationOf({ command }));

const SETTLED: Settlement = { kind: "settled" };

const UNRESOLVED: Settlement = { kind: "unresolved" };

type PrefixRole = "runner" | "setting" | "wrapper";

const prefixRoleOf = (request: {
  readonly token: ShellToken;
  readonly following: readonly ShellToken[];
}): PrefixRole => {
  if (PLAIN_RUNNER_TOKENS.includes(request.token.text)) return "runner";
  if (request.token.expansion === "literal" && ENVIRONMENT_ASSIGNMENT.test(request.token.text))
    return "setting";
  const settingsOnlyFollow = request.following.every((token) =>
    ENVIRONMENT_ASSIGNMENT.test(token.text),
  );
  return request.token.text === ENVIRONMENT_SETTER && settingsOnlyFollow ? "setting" : "wrapper";
};

const reachSettlementOf = (request: { readonly token: ShellToken }): Settlement =>
  request.token.expansion !== "literal" || UNSETTLED_TEXT.test(request.token.text)
    ? UNRESOLVED
    : SETTLED;

const prefixSettlementOf = (request: { readonly prefix: readonly ShellToken[] }): Settlement => {
  const wrapper = request.prefix.find(
    (token, index) =>
      prefixRoleOf({ token, following: request.prefix.slice(index + 1) }) === "wrapper",
  );
  return wrapper === undefined
    ? SETTLED
    : { kind: "not-plain", reason: { kind: "wrapped", wrapper: wrapper.text } };
};

const orderSettlementOf = (request: {
  readonly index: number;
  readonly command: ShellCommand;
}): Settlement =>
  request.index === 0
    ? SETTLED
    : {
        kind: "not-plain",
        reason: {
          kind: "after-another-command",
          invocation: request.command.map((token) => token.written).join(" "),
        },
      };

const settlementOf = (request: {
  readonly index: number;
  readonly command: ShellCommand;
  readonly eslintIndex: number;
}): Settlement => {
  const settlements: readonly Settlement[] = [
    ...request.command.slice(request.eslintIndex + 1).map((token) => reachSettlementOf({ token })),
    prefixSettlementOf({ prefix: request.command.slice(0, request.eslintIndex) }),
    orderSettlementOf(request),
  ];
  return settlements.find((settlement) => settlement.kind !== "settled") ?? SETTLED;
};

const settledInvocationOf = (request: {
  readonly index: number;
  readonly command: ShellCommand;
}): readonly SettledInvocation[] => {
  const eslintIndex = request.command.findIndex(
    (token) => eslintNamingOf({ token: token.text }) === "names-eslint",
  );
  return invocationOf({ command: textsOf({ command: request.command }) }).map((invocation) => ({
    ...invocation,
    arguments: request.command
      .slice(eslintIndex + 1)
      .filter((token) => token.text !== FORWARDED_OPTIONS_SEPARATOR),
    settlement: settlementOf({ index: request.index, command: request.command, eslintIndex }),
    command: request.command[eslintIndex]?.text ?? "",
  }));
};

const settledInvocationsOf = (request: {
  readonly commands: readonly ShellCommand[];
}): readonly SettledInvocation[] =>
  request.commands.flatMap((command, index) => settledInvocationOf({ index, command }));

const occurrenceFormOf = (request: {
  readonly token: string;
  readonly name: string;
  readonly arity: OptionArity;
}): "joined-value" | "separate" | "not-this-option" => {
  if (request.arity === "takes-value" && request.token.startsWith(`${request.name}=`)) {
    return "joined-value";
  }
  return request.token === request.name ? "separate" : "not-this-option";
};

const occurrenceAt = (request: {
  readonly token: string;
  readonly next: string;
  readonly name: string;
  readonly arity: OptionArity;
}): readonly OptionOccurrence[] => {
  const form = occurrenceFormOf({ token: request.token, name: request.name, arity: request.arity });
  if (form === "not-this-option") {
    return [];
  }
  if (form === "joined-value") {
    return [
      {
        option: request.token,
        optionValue: request.token.slice(request.name.length + 1),
        valueOffset: 0,
      },
    ];
  }
  const optionValue = request.arity === "takes-value" ? request.next : "";
  return [
    {
      option: optionValue === "" ? request.token : `${request.token} ${optionValue}`,
      optionValue,
      valueOffset: request.arity === "takes-value" ? 1 : 0,
    },
  ];
};

const ruleIdsNamedBy = (request: {
  readonly value: string;
  readonly selectedRuleIds: readonly string[];
}): readonly string[] => {
  const named = request.value
    .split(RULE_VALUE_SEPARATORS)
    .map((part) => part.trim())
    .map((part) => SURROUNDING_QUOTES.exec(part)?.groups?.inner ?? part);
  return request.selectedRuleIds.filter((ruleId) => named.includes(ruleId));
};

const reachedRuleIds = (request: {
  readonly spec: WeakeningSpec;
  readonly optionValue: string;
  readonly selectedRuleIds: readonly string[];
}): readonly string[] =>
  request.spec.reach === "every-clause"
    ? request.selectedRuleIds
    : ruleIdsNamedBy({ value: request.optionValue, selectedRuleIds: request.selectedRuleIds });

const specWeakenings = (request: {
  readonly spec: WeakeningSpec;
  readonly token: string;
  readonly next: string;
  readonly index: number;
  readonly selectedRuleIds: readonly string[];
}): readonly LocatedWeakening[] =>
  occurrenceAt({
    token: request.token,
    next: request.next,
    name: request.spec.name,
    arity: request.spec.arity,
  }).map((occurrence) => ({
    weakening: {
      option: occurrence.option,
      ruleIds: reachedRuleIds({
        spec: request.spec,
        optionValue: occurrence.optionValue,
        selectedRuleIds: request.selectedRuleIds,
      }),
      effect: effectOf({ judgement: request.spec.judgement, optionValue: occurrence.optionValue }),
    },
    valueAt: request.index + occurrence.valueOffset,
    optionValue: occurrence.optionValue,
  }));

const tokenWeakenings = (request: {
  readonly token: string;
  readonly next: string;
  readonly index: number;
  readonly selectedRuleIds: readonly string[];
}): readonly LocatedWeakening[] =>
  WEAKENING_OPTIONS.flatMap((spec) => specWeakenings({ ...request, spec }));

const locatedWeakeningsOf = (request: {
  readonly invocation: EslintInvocation;
  readonly selectedRuleIds: readonly string[];
}): readonly LocatedWeakening[] =>
  request.invocation.options
    .flatMap((token, index) =>
      tokenWeakenings({
        token,
        next: request.invocation.options[index + 1] ?? "",
        index,
        selectedRuleIds: request.selectedRuleIds,
      }),
    )
    .filter((located) => located.weakening.ruleIds.length > 0);

export const commandLineOptionsOf = (request: {
  readonly invocation: EslintInvocation;
  readonly selectedRuleIds: readonly string[];
}): readonly WeakeningOption[] => locatedWeakeningsOf(request).map((located) => located.weakening);

const suppressionsLocationsAt = (request: {
  readonly token: string;
  readonly next: string;
}): readonly string[] =>
  occurrenceAt({
    token: request.token,
    next: request.next,
    name: SUPPRESSIONS_LOCATION_OPTION,
    arity: "takes-value",
  }).map((occurrence) => occurrence.optionValue);

export const suppressionsLocationValuesOf = (request: {
  readonly invocation: EslintInvocation;
}): readonly string[] =>
  request.invocation.options.flatMap((token, index) =>
    suppressionsLocationsAt({ token, next: request.invocation.options[index + 1] ?? "" }),
  );

const nextWalk = (request: {
  readonly walk: SegmentWalk;
  readonly segment: string;
}): SegmentWalk => {
  const walk = request.walk;
  if (walk.position === "outside" || request.segment === "" || request.segment === ".") {
    return walk;
  }
  if (request.segment === ".." && walk.segments.length === 0) {
    return { position: "outside" };
  }
  if (request.segment === "..") {
    return { position: "inside", segments: walk.segments.slice(0, -1) };
  }
  return { position: "inside", segments: [...walk.segments, request.segment] };
};

const walkedSegments = (request: {
  readonly baseSegments: readonly string[];
  readonly path: string;
}): SegmentWalk =>
  [...request.baseSegments, ...request.path.split("/")].reduce<SegmentWalk>(
    (walk, segment) => nextWalk({ walk, segment }),
    { position: "inside", segments: [] },
  );

export const repoPathResolved = (request: {
  readonly baseSegments: readonly string[];
  readonly path: string;
}): Result<RepoPath, { readonly kind: "not-repo-path"; readonly path: string }> => {
  const refused: Result<RepoPath, { readonly kind: "not-repo-path"; readonly path: string }> = {
    outcome: "failed",
    error: { kind: "not-repo-path", path: request.path },
  };
  if (request.path.startsWith("/")) {
    return refused;
  }
  const walk = walkedSegments(request);
  if (walk.position === "outside") {
    return refused;
  }
  const parsed = repoPathSchema.safeParse(walk.segments.join("/"));
  if (!parsed.success) {
    return refused;
  }
  return { outcome: "ok", value: parsed.data };
};

const optionSettlementOf = (request: {
  readonly located: LocatedWeakening;
  readonly invocation: SettledInvocation;
}): Settlement =>
  request.invocation.arguments[request.located.valueAt]?.expansion === "shell-supplied"
    ? { kind: "not-plain", reason: { kind: "shell-supplied", value: request.located.optionValue } }
    : request.invocation.settlement;

const scriptOptionOf = <Subject extends RuleSubject>(request: {
  readonly located: LocatedWeakening;
  readonly invocation: SettledInvocation;
  readonly path: RepoPath;
  readonly script: string;
  readonly selectedRules: readonly ScannedRule<Subject>[];
}): ScriptOption<Subject> => ({
  location: request.path,
  effect: request.located.weakening.effect,
  settlement: optionSettlementOf(request),
  command: request.invocation.command,
  exceptions: request.selectedRules
    .filter((rule) => request.located.weakening.ruleIds.includes(rule.ruleId))
    .map((rule): ScriptOptionException<Subject> => ({
      ...rule.subject,
      kind: "command-line-option",
      location: request.path,
      script: request.script,
      option: request.located.weakening.option,
    })),
});

const scriptOptionsOf = <Subject extends RuleSubject>(request: {
  readonly invocations: readonly SettledInvocation[];
  readonly path: RepoPath;
  readonly script: string;
  readonly selectedRules: readonly ScannedRule<Subject>[];
}): readonly ScriptOption<Subject>[] => {
  const selectedRuleIds = request.selectedRules.map((rule) => rule.ruleId);
  return request.invocations.flatMap((invocation) =>
    locatedWeakeningsOf({ invocation, selectedRuleIds }).map((located) =>
      scriptOptionOf({ ...request, located, invocation }),
    ),
  );
};

const locatedScan = <Subject extends RuleSubject>(request: {
  readonly scan: Result<PackageJsonScan<Subject>, RunnerFailure>;
  readonly locationText: string;
  readonly baseSegments: readonly string[];
  readonly path: RepoPath;
  readonly script: string;
}): Result<PackageJsonScan<Subject>, RunnerFailure> => {
  if (request.scan.outcome === "failed") {
    return request.scan;
  }
  const location = repoPathResolved({
    baseSegments: request.baseSegments,
    path: request.locationText,
  });
  if (location.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `script "${request.script}" in ${request.path} names --suppressions-location ${request.locationText}, which is not a repo path`,
      },
    };
  }
  return {
    outcome: "ok",
    value: {
      ...request.scan.value,
      suppressionsLocations: [
        ...request.scan.value.suppressionsLocations,
        { location: location.value, script: request.script },
      ],
    },
  };
};

const EMPTY_SCAN: PackageJsonScan<never> = {
  scriptOptions: [],
  suppressionsLocations: [],
  unreadableScripts: [],
};

type ScriptRequest<Subject extends RuleSubject> = {
  readonly path: RepoPath;
  readonly script: string;
  readonly scriptText: string;
  readonly selectedRules: readonly ScannedRule<Subject>[];
};

const unreadableScan = <Subject extends RuleSubject>(
  request: ScriptRequest<Subject>,
): PackageJsonScan<Subject> => {
  const command = request.scriptText
    .split(UNREADABLE_SCRIPT_BREAKS)
    .find((piece) => eslintNamingOf({ token: piece }) === "names-eslint");
  if (command === undefined) {
    return EMPTY_SCAN;
  }
  return {
    ...EMPTY_SCAN,
    unreadableScripts: [
      {
        command,
        exceptions: request.selectedRules.map((rule): ScriptOptionException<Subject> => ({
          ...rule.subject,
          kind: "command-line-option",
          location: request.path,
          script: request.script,
          option: request.scriptText,
        })),
      },
    ],
  };
};

const scriptScan = <Subject extends RuleSubject>(
  request: ScriptRequest<Subject>,
): Result<PackageJsonScan<Subject>, RunnerFailure> => {
  const commands = shellCommandsOf({ script: request.scriptText });
  if (commands.outcome === "failed") {
    return { outcome: "ok", value: unreadableScan(request) };
  }
  const invocations = settledInvocationsOf({ commands: commands.value });
  const baseSegments = request.path.split("/").slice(0, -1);
  return invocations
    .flatMap((invocation) => suppressionsLocationValuesOf({ invocation }))
    .reduce<Result<PackageJsonScan<Subject>, RunnerFailure>>(
      (scan, locationText) =>
        locatedScan({
          scan,
          locationText,
          baseSegments,
          path: request.path,
          script: request.script,
        }),
      {
        outcome: "ok",
        value: { ...EMPTY_SCAN, scriptOptions: scriptOptionsOf({ ...request, invocations }) },
      },
    );
};

const mergedScriptScan = <Subject extends RuleSubject>(request: {
  readonly scan: Result<PackageJsonScan<Subject>, RunnerFailure>;
  readonly script: string;
  readonly scriptText: string;
  readonly path: RepoPath;
  readonly selectedRules: readonly ScannedRule<Subject>[];
}): Result<PackageJsonScan<Subject>, RunnerFailure> => {
  if (request.scan.outcome === "failed") {
    return request.scan;
  }
  const scanned = scriptScan({
    path: request.path,
    script: request.script,
    scriptText: request.scriptText,
    selectedRules: request.selectedRules,
  });
  if (scanned.outcome === "failed") {
    return scanned;
  }
  return {
    outcome: "ok",
    value: {
      scriptOptions: [...request.scan.value.scriptOptions, ...scanned.value.scriptOptions],
      suppressionsLocations: [
        ...request.scan.value.suppressionsLocations,
        ...scanned.value.suppressionsLocations,
      ],
      unreadableScripts: [
        ...request.scan.value.unreadableScripts,
        ...scanned.value.unreadableScripts,
      ],
    },
  };
};

export type PackageScripts = Readonly<Record<string, string>>;

export const packageScriptsOf = (request: {
  readonly path: RepoPath;
  readonly text: string;
}): Result<PackageScripts, RunnerFailure> => {
  const json = parsedJson({ text: request.text });
  if (json.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.path}: ${json.error}` },
    };
  }
  const packageJson = packageJsonSchema.safeParse(json.value);
  if (!packageJson.success) {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `${request.path}: ${z.prettifyError(packageJson.error)}`,
      },
    };
  }
  return { outcome: "ok", value: packageJson.data.scripts ?? {} };
};

export type PackageScriptsReader = (request: {
  readonly packagePath: RepoPath;
}) => Result<PackageScripts, RunnerFailure>;

export const packageScriptsReaderOf =
  (request: {
    readonly fileText: FileTextPort;
    readonly path: PathPort;
    readonly repoRoot: AbsolutePath;
  }): PackageScriptsReader =>
  ({ packagePath }) => {
    const text = request.fileText.read({
      path: request.path.join({ segments: [request.repoRoot, packagePath] }),
    });
    if (text.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "file-unreadable", file: packagePath, detail: text.error.detail },
      };
    }
    return packageScriptsOf({ path: packagePath, text: text.value });
  };

export const scannedScriptsFor = <Subject extends RuleSubject>(request: {
  readonly path: RepoPath;
  readonly scripts: PackageScripts;
  readonly selectedRules: readonly ScannedRule<Subject>[];
}): Result<PackageJsonScan<Subject>, RunnerFailure> =>
  Object.entries(request.scripts).reduce<Result<PackageJsonScan<Subject>, RunnerFailure>>(
    (scan, [script, scriptText]) =>
      mergedScriptScan({
        scan,
        script,
        scriptText,
        path: request.path,
        selectedRules: request.selectedRules,
      }),
    { outcome: "ok", value: EMPTY_SCAN },
  );

export const scannedPackageScripts = (request: {
  readonly path: RepoPath;
  readonly scripts: PackageScripts;
  readonly selectedRules: readonly SelectedRule[];
}): Result<PackageJsonScan, RunnerFailure> =>
  scannedScriptsFor({
    ...request,
    selectedRules: request.selectedRules.map(({ ruleId, clause }) => ({
      ruleId,
      subject: { clause },
    })),
  });

export const scanPackageJson = (request: {
  readonly path: RepoPath;
  readonly text: string;
  readonly selectedRules: readonly SelectedRule[];
}): Result<PackageJsonScan, RunnerFailure> => {
  const scripts = packageScriptsOf(request);
  return scripts.outcome === "failed"
    ? scripts
    : scannedPackageScripts({
        path: request.path,
        scripts: scripts.value,
        selectedRules: request.selectedRules,
      });
};
