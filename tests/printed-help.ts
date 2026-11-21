import { runToolCommand } from "../src/run-tool-command.ts";
import { commandOver, memoryRepositoryOf, recordedProcessWith } from "./command-harness.ts";

const FENCE = "```";

const HELP_BLOCK = /```text\n(usage: [\s\S]*?)```/g;

export const printedHelpBlockOf = async (request: {
  readonly given: readonly string[];
  readonly files: Readonly<Record<string, string>>;
}): Promise<string> => {
  const recorded = recordedProcessWith({ arguments: request.given });
  await runToolCommand(commandOver({ process: recorded.port, fileText: memoryRepositoryOf({ files: request.files }).fileText }));
  return `${FENCE}text\n${recorded.writes.map(([written]) => written.text).join("")}${FENCE}`;
};

export const printedHelpBlocksOf = async (request: {
  readonly cases: readonly { readonly given: readonly string[] }[];
  readonly files: Readonly<Record<string, string>>;
}): Promise<readonly string[]> =>
  (await Promise.all(request.cases.map(({ given }) => printedHelpBlockOf({ given, files: request.files })))).toSorted();

export const helpBlocksIn = (request: { readonly text: string }): readonly string[] =>
  [...request.text.matchAll(HELP_BLOCK)].map((match) => match[0]).toSorted();
