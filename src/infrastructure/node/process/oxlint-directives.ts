import { runOxlintProcess, type Diagnostic, type OxlintInvocation } from "./oxlint-diagnostics.ts";

const disableMarker = /(?:oxlint|eslint)-disable/u;

export type DisableDirective = {
  readonly fileName: string;
  readonly line: number;
  readonly text: string;
};

const removeDisableDirective = (request: {
  readonly diagnostic: Diagnostic;
  readonly sources: ReadonlyMap<string, Buffer>;
  readonly observe?: ((directive: DisableDirective) => void) | undefined;
}): void => {
  const { diagnostic } = request;
  const filename = diagnostic.filename.replaceAll("\\", "/");
  const source = request.sources.get(filename);
  const span = diagnostic.labels[0]?.span;
  if (
    !/^Unused (?:eslint|oxlint)-disable directive/u.test(diagnostic.message) ||
    source === undefined ||
    span === undefined ||
    span.offset + span.length > source.length
  )
    throw new Error(`${filename}: ${diagnostic.message}`);
  const comment = source.subarray(span.offset, span.offset + span.length).toString();
  const marker = disableMarker.exec(comment);
  if (marker === null) throw new Error(`${filename}: Oxlint reported an unknown directive`);
  const offset = span.offset + Buffer.byteLength(comment.slice(0, marker.index));
  request.observe?.({ fileName: filename, line: span.line, text: comment });
  source.fill(32, offset, offset + marker[0].length);
};

export const removeDisableDirectives = (
  request: OxlintInvocation & {
    readonly sources: ReadonlyMap<string, Buffer>;
    readonly run?: typeof runOxlintProcess;
    readonly observe?: ((directive: DisableDirective) => void) | undefined;
  },
): "changed" | "unchanged" => {
  if (![...request.sources.values()].some((source) => disableMarker.test(source.toString())))
    return "unchanged";
  const diagnostics = (request.run ?? runOxlintProcess)({
    ...request,
    options: ["--report-unused-disable-directives"],
    rules: 0,
  });
  const directives = new Map(
    diagnostics.map((diagnostic) => [
      `${diagnostic.filename}:${diagnostic.labels[0]?.span.offset}`,
      diagnostic,
    ]),
  );
  directives.forEach((diagnostic) => removeDisableDirective({ ...request, diagnostic }));
  return directives.size > 0 ? "changed" : "unchanged";
};
