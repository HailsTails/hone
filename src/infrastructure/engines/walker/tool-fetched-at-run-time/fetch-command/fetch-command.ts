import type { Anchor } from "../../../../../domain/finding/anchor.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import {
  dependencySourceOf,
  locatedPackageManifestOf,
  PACKAGE_MANIFEST,
  WORKFLOW,
} from "../../runner/pieces/dependency-files.ts";
import type { WalkerFile, WalkerPiece } from "../../runner/pieces/walker-piece.ts";

type Command = { readonly text: string; readonly anchor: Anchor; readonly snippet: string };
type CommandFile = "shell" | "workflow" | "gitlab";

const SHELL = /\.(?:sh|bash|zsh|ps1|cmd|bat)$/;
const COMMAND_START =
  /(?:^|[;&|])\s*(?:exec\s+|call\s+)?(?:corepack\s+)?(?<quote>['"]?)(?:(?:npx|pnpx|bunx)(?:\.(?:cmd|bat|exe|ps1))?|bun\s+x|pnpm\s+dlx|yarn\s+dlx|npm\s+exec)\k<quote>(?=$|[\s;&|])/i;
const DOWNLOAD_PIPE =
  /(?:^|[;&|])\s*(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|\r\n]*\|\s*(?:sh|bash|zsh|pwsh|powershell|iex|Invoke-Expression)\b/i;
const GITLAB_SCRIPT =
  /^(?:-\s+)?(?:before_script|script|after_script|pre_get_sources_script)\s*:\s*/;
const GITLAB_VARIABLES = /^variables\s*:/;
const YAML_ANCHOR = /^[.\w-]+\s*:\s*&(?<anchor>[\w.-]+)(?:\s+(?<command>.*))?$/;
const YAML_ALIAS = /^\*(?<name>[\w.-]+)(?:\s+#.*)?$/;
const SEQUENCE_ITEM = /^-\s+/;
const WORKFLOW_COMMAND = /^(?:-\s+)?(?:run|script)\s*:\s*/;
const YAML_BLOCK = /^(?:&\S+\s*)?(?:[|>][+\d-]*)?(?:\s*#.*)?$/;
const YAML_STRING = /^(?:"(?<double>(?:[^"\\]|\\.)*)"|'(?<single>(?:[^']|'')*)')$/;

const yamlCommandOf = (source: string): string => {
  const quoted = YAML_STRING.exec(source)?.groups;
  if (quoted?.double !== undefined) return quoted.double.replaceAll('\\"', '"');
  if (quoted?.single !== undefined) return quoted.single.replaceAll("''", "'");
  return source;
};

type YamlLine = { readonly snippet: string; readonly indent: number; readonly anchor: Anchor };
type ScriptScan = {
  readonly scriptIndent: number | undefined;
  readonly variablesIndent: number | undefined;
  readonly commands: Command[];
};

const isolatedYamlLines = (source: string): readonly YamlLine[] =>
  source.split(/\r?\n/).flatMap((line, index) => {
    const snippet = line.trim();
    if (snippet.length === 0 || snippet.startsWith("#")) return [];
    return [
      {
        snippet,
        indent: line.length - line.trimStart().length,
        anchor: { line: index + 1, column: 0 },
      },
    ];
  });

const scanCommandLine = (request: {
  readonly scan: ScriptScan;
  readonly line: YamlLine;
  readonly headerValueOf: (snippet: string) => string | undefined;
}): ScriptScan => {
  const { scan, line, headerValueOf } = request;
  const { snippet, indent, anchor } = line;
  if (scan.variablesIndent !== undefined && indent > scan.variablesIndent) return scan;
  const current = { ...scan, variablesIndent: undefined };
  if (GITLAB_VARIABLES.test(snippet))
    return { ...current, scriptIndent: undefined, variablesIndent: indent };
  const command = headerValueOf(snippet);
  if (command !== undefined) {
    current.commands.push({ text: yamlCommandOf(command), anchor, snippet });
    return { ...current, scriptIndent: YAML_BLOCK.test(command) ? indent : undefined };
  }
  const { scriptIndent } = current;
  if (scriptIndent === undefined) return current;
  if (indent < scriptIndent || (indent === scriptIndent && !SEQUENCE_ITEM.test(snippet)))
    return { ...current, scriptIndent: undefined };
  const text = SEQUENCE_ITEM.test(snippet)
    ? yamlCommandOf(snippet.replace(SEQUENCE_ITEM, ""))
    : snippet;
  current.commands.push({ text, anchor, snippet });
  return current;
};

const commandsUnder = (request: {
  readonly lines: readonly YamlLine[];
  readonly headerValueOf: (snippet: string) => string | undefined;
}): readonly Command[] =>
  request.lines.reduce<ScriptScan>(
    (scan, line) => scanCommandLine({ scan, line, headerValueOf: request.headerValueOf }),
    { scriptIndent: undefined, variablesIndent: undefined, commands: [] },
  ).commands;

const gitlabCommandsOf = (source: string): readonly Command[] => {
  const lines = isolatedYamlLines(source);
  const scripts = commandsUnder({
    lines,
    headerValueOf: (snippet) =>
      GITLAB_SCRIPT.test(snippet) ? snippet.replace(GITLAB_SCRIPT, "") : undefined,
  });
  const aliases = new Set(
    scripts.flatMap(({ text }) => {
      const name = YAML_ALIAS.exec(text)?.groups?.name;
      return name === undefined ? [] : [name];
    }),
  );
  if (aliases.size === 0) return scripts;
  const anchors = commandsUnder({
    lines,
    headerValueOf: (snippet) => {
      const definition = YAML_ANCHOR.exec(snippet)?.groups;
      return definition?.anchor !== undefined && aliases.has(definition.anchor)
        ? (definition.command ?? "")
        : undefined;
    },
  });
  return [
    ...new Map([...scripts, ...anchors].map((command) => [command.anchor.line, command])).values(),
  ].toSorted((left, right) => left.anchor.line - right.anchor.line);
};

const sourceCommandsOf = (request: {
  readonly source: string;
  readonly kind: Exclude<CommandFile, "gitlab">;
}): readonly Command[] =>
  request.source.split(/\r?\n/).flatMap((line, index) => {
    const snippet = line.trim();
    if (snippet.startsWith("#") || snippet.startsWith("::")) return [];
    const text =
      request.kind === "workflow" && WORKFLOW_COMMAND.test(snippet)
        ? yamlCommandOf(snippet.replace(WORKFLOW_COMMAND, ""))
        : snippet;
    return [{ text, anchor: { line: index + 1, column: 0 }, snippet }];
  });

type Commands = Result<readonly Command[] | undefined, PieceFailure>;

const manifestCommandsOf = (file: WalkerFile): Commands => {
  const located = locatedPackageManifestOf(file);
  if (located.outcome === "failed") return located;
  const manifest = located.value;
  if (manifest === undefined) return { outcome: "ok", value: undefined };
  return {
    outcome: "ok",
    value: Array.from(manifest.get("scripts")?.fields.values() ?? []).flatMap(
      ({ value: text, anchor, snippet }) =>
        typeof text === "string" ? [{ text, anchor, snippet }] : [],
    ),
  };
};

const commandFileOf = (file: WalkerFile["file"]): CommandFile => {
  const workflow = WORKFLOW.exec(file);
  if (workflow === null) return "shell";
  return workflow.groups?.gitlab === undefined ? "workflow" : "gitlab";
};

const fileCommandsOf = (file: WalkerFile & { readonly kind: CommandFile }): Commands => {
  const source = dependencySourceOf({ ...file, accepts: file.kind === "shell" ? SHELL : WORKFLOW });
  return source.outcome === "failed"
    ? source
    : {
        outcome: "ok",
        value:
          source.value === undefined
            ? undefined
            : file.kind === "gitlab"
              ? gitlabCommandsOf(source.value)
              : sourceCommandsOf({ source: source.value, kind: file.kind }),
      };
};

export const check: WalkerPiece = {
  prepare: ({ bindings }) => ({
    outcome: "ok",
    value: {
      prepareFile: (file) => {
        const manifest = PACKAGE_MANIFEST.test(file.file);
        const commands = manifest
          ? manifestCommandsOf(file)
          : fileCommandsOf({ ...file, kind: commandFileOf(file.file) });
        if (commands.outcome === "failed") return commands;
        if (commands.value === undefined) return { outcome: "ok", value: { kind: "skipped" } };
        const hits = commands.value
          .filter(({ text }) => COMMAND_START.test(text) || DOWNLOAD_PIPE.test(text))
          .flatMap(({ anchor, snippet }) =>
            bindings.map(({ address }) => ({
              check: address,
              anchor,
              snippet,
            })),
          );
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
