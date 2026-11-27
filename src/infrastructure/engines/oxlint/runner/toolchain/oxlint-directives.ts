import { runOxlintProcess, type Diagnostic, type OxlintInvocation } from "./oxlint-diagnostics.ts";

const disableMarker = /(?:oxlint|eslint)-disable/u;

export type DisableDirective = {
  readonly fileName: string;
  readonly line: number;
  readonly text: string;
};

const mapDiagnosticToDirective = (request: {
  readonly diagnostic: Diagnostic;
  readonly sources: ReadonlyMap<string, Buffer>;
}): DisableDirective & {
  readonly source: Buffer;
  readonly start: number;
  readonly end: number;
} => {
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
  const start = span.offset + Buffer.byteLength(comment.slice(0, marker.index));
  return {
    fileName: filename,
    line: span.line,
    text: comment,
    source,
    start,
    end: start + marker[0].length,
  };
};

export const findDisableMarker = (source: string): RegExpExecArray | null =>
  disableMarker.exec(source);

type DisableInspection = OxlintInvocation & {
  readonly sources: ReadonlyMap<string, Buffer>;
  readonly config?: string;
  readonly targets?: readonly string[];
  readonly run?: typeof runOxlintProcess;
};

const inspectDisableDirectives = (request: DisableInspection) => {
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
  return [...directives.values()].map((diagnostic) =>
    mapDiagnosticToDirective({ ...request, diagnostic }),
  );
};

export const readDisableDirectives = (request: DisableInspection): readonly DisableDirective[] =>
  inspectDisableDirectives(request).map(({ fileName, line, text }) => ({ fileName, line, text }));

export const createSourcesWithoutDisables = (
  request: DisableInspection,
): ReadonlyMap<string, Buffer> => {
  const updated = new Map<string, Buffer>();
  if (
    ![...request.sources.values()].some((source) => findDisableMarker(source.toString()) !== null)
  )
    return updated;
  inspectDisableDirectives(request).forEach(({ fileName, source, start, end }) => {
    const copy = updated.get(fileName) ?? Buffer.from(source);
    copy.fill(32, start, end);
    updated.set(fileName, copy);
  });
  return updated;
};
