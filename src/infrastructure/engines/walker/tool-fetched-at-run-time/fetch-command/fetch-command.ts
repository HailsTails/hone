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
  /(?:^|[;&|])\s*(?:exec\s+|call\s+)?(?:corepack\s+)?(?:npx|pnpx|bunx|bun\s+x|pnpm\s+dlx|yarn\s+dlx|npm\s+exec)\b(?!=)/i;
const DOWNLOAD_PIPE =
  /(?:^|[;&|])\s*(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|\r\n]*\|\s*(?:sh|bash|zsh|pwsh|powershell|iex|Invoke-Expression)\b/i;

const sourceCommandsOf = (request: {
  readonly source: string;
  readonly kind: CommandFile;
}): readonly Command[] =>
  request.source.split(/\r?\n/).flatMap((line, index) => {
    const snippet = line.trim();
    if (snippet.startsWith("#") || snippet.startsWith("::")) return [];
    const workflowCommand = snippet.replace(/^(?:-\s+)?(?:run|script)\s*:\s*/, "");
    const command =
      request.kind === "gitlab" ? workflowCommand.replace(/^-\s+/, "") : workflowCommand;
    const text = request.kind === "shell" ? snippet : command.replace(/^(?:'|")|(?:'|")$/g, "");
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
