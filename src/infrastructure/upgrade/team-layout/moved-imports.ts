import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { ImportsRewrittenOf } from "../../../application/ports/upgrade/version-one-team-layout.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";

type BeyondSpecifiers = "beyond-import-specifiers";

type Specifier = { readonly start: number; readonly end: number; readonly text: string };

type TargetForm = { readonly found: RepoPath; readonly suffix: string };

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

const STATIC_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"'\n]*)\2/g;

const UNREWRITABLE_FORM = /\bimport\.meta\b|\brequire\s*\(|\bimport\s*\(\s*[^"'\s]/;

const ANCHOR = "/";

const CURRENT_FOLDER = "./";

const ADDED_SUFFIXES: readonly string[] = ["", ".ts", "/index.ts"];

const JS_FOR_TS = "js-for-ts";

const JS_EXTENSION = /\.js$/;

const TS_EXTENSION = ".ts";

const TS_FILE = /\.ts$/;

const specifiersOf = (text: string): readonly Specifier[] =>
  [...text.matchAll(STATIC_SPECIFIER)].flatMap((match) => {
    const [, lead, quote, specifier] = match;
    if (lead === undefined || quote === undefined || specifier === undefined) return [];
    const start = match.index + lead.length + quote.length;
    return [{ start, end: start + specifier.length, text: specifier }];
  });

const anchored = (path: string): string => `${ANCHOR}${path}`;

const unanchored = (path: string): string => path.slice(ANCHOR.length);

const targetFormOf = (request: {
  readonly target: string;
  readonly moved: ReadonlyMap<RepoPath, RepoPath>;
}): TargetForm | undefined => {
  const forms = [
    ...ADDED_SUFFIXES.map((suffix) => ({ path: `${request.target}${suffix}`, suffix })),
    { path: request.target.replace(JS_EXTENSION, TS_EXTENSION), suffix: JS_FOR_TS },
  ];
  const [form] = forms.flatMap(({ path, suffix }) =>
    [...request.moved.keys()].filter((key) => key === path).map((found) => ({ found, suffix })),
  );
  return form;
};

const writtenTargetOf = (request: { readonly to: RepoPath; readonly suffix: string }): string => {
  if (request.suffix === JS_FOR_TS) return request.to.replace(TS_FILE, ".js");
  return request.suffix === "" ? request.to : request.to.slice(0, -request.suffix.length);
};

const rewrittenSpecifierOf = (request: {
  readonly path: PathPort;
  readonly specifier: Specifier;
  readonly file: RepoPath;
  readonly movedTo: RepoPath;
  readonly folder: RepoPath;
  readonly moved: ReadonlyMap<RepoPath, RepoPath>;
}): Result<string, BeyondSpecifiers> => {
  const { path, specifier } = request;
  const target = unanchored(
    path.join({
      segments: [path.directoryOf({ path: anchored(request.file) }), specifier.text],
    }),
  );
  const form = targetFormOf({ target, moved: request.moved });
  if (form === undefined) {
    return target.startsWith(`${request.folder}${ANCHOR}`)
      ? { outcome: "failed", error: "beyond-import-specifiers" }
      : { outcome: "ok", value: specifier.text };
  }
  const to = request.moved.get(form.found);
  if (to === undefined) return { outcome: "ok", value: specifier.text };
  const relative = path.relative({
    from: path.directoryOf({ path: anchored(request.movedTo) }),
    to: anchored(writtenTargetOf({ to, suffix: form.suffix })),
  });
  if (relative.relation === "different-root") {
    return { outcome: "failed", error: "beyond-import-specifiers" };
  }
  return {
    outcome: "ok",
    value: relative.path.startsWith(".") ? relative.path : `${CURRENT_FOLDER}${relative.path}`,
  };
};

export const createImportsRewrittenOf =
  (options: { readonly path: PathPort }): ImportsRewrittenOf =>
  (request) => {
    if (!SCRIPT_FILE.test(request.file)) return { outcome: "ok", value: request.text };
    if (UNREWRITABLE_FORM.test(request.text)) {
      return { outcome: "failed", error: "beyond-import-specifiers" };
    }
    const rewrites = specifiersOf(request.text).map((specifier) => ({
      specifier,
      rewritten: rewrittenSpecifierOf({ ...request, path: options.path, specifier }),
    }));
    const refused = rewrites.find(({ rewritten }) => rewritten.outcome === "failed");
    if (refused !== undefined) {
      return { outcome: "failed", error: "beyond-import-specifiers" };
    }
    return {
      outcome: "ok",
      value: rewrites.reduceRight(
        (text, { specifier, rewritten }) =>
          rewritten.outcome === "ok"
            ? `${text.slice(0, specifier.start)}${rewritten.value}${text.slice(specifier.end)}`
            : text,
        request.text,
      ),
    };
  };
