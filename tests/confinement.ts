import { createPathPort, type PathPort } from "../src/infrastructure/node/path-port.ts";
import { type ImportFactsIn, type ImportStatementIn, importFactsIn, importsIn, importStatementsIn, type ModuleImport } from "./module-imports.ts";

export type ConfinementVerdict = "allowed" | "outside";

export type ImportAllowance = (request: { readonly moduleImport: ModuleImport }) => ConfinementVerdict;

export type ImportOutside = ModuleImport & { readonly file: string };

export type PathCallsOutside = {
  readonly called: "at least once" | "never";
  readonly outside: readonly string[];
};

const RELATIVE_SPECIFIER = /^\.\.?\//;

const PACKAGE_OR_COMPUTED_SPECIFIER = /^[^.]/;

const NODE_BUILTIN_SPECIFIER = /^node:/;

const COMPUTED_SPECIFIER = /[^\w@/.:-]/;

const STATIC_FORMS: readonly ModuleImport["form"][] = ["value", "type-only"];

const INSTALL_ROOT = "/install";

export const relativeImport: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) && STATIC_FORMS.includes(moduleImport.form) ? "allowed" : "outside";

export const relativeImportOfAnyForm: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) ? "allowed" : "outside";

export const nodeBuiltinImport: ImportAllowance = ({ moduleImport }) =>
  NODE_BUILTIN_SPECIFIER.test(moduleImport.specifier) && STATIC_FORMS.includes(moduleImport.form)
    ? "allowed"
    : "outside";

export const computedModuleLoad: ImportAllowance = ({ moduleImport }) =>
  COMPUTED_SPECIFIER.test(moduleImport.specifier) && moduleImport.form === "dynamic" ? "allowed" : "outside";

export const packageOrComputedImport: ImportAllowance = ({ moduleImport }) =>
  PACKAGE_OR_COMPUTED_SPECIFIER.test(moduleImport.specifier) ? "allowed" : "outside";

export const packageImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && STATIC_FORMS.includes(moduleImport.form) ? "allowed" : "outside";

export const packageTypeImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && moduleImport.form === "type-only" ? "allowed" : "outside";

export const packageDynamicImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && moduleImport.form === "dynamic" ? "allowed" : "outside";

export const dynamicLoadMatching =
  (request: { readonly specifier: RegExp }): ImportAllowance =>
  ({ moduleImport }) =>
    request.specifier.test(moduleImport.specifier) && moduleImport.form === "dynamic" ? "allowed" : "outside";

export const importNotMatching =
  (request: { readonly specifier: RegExp }): ImportAllowance =>
  ({ moduleImport }) =>
    request.specifier.test(moduleImport.specifier) ? "outside" : "allowed";

const reachOf = (request: {
  readonly importingPath: PathPort;
  readonly reach: RegExp;
  readonly specifier: string;
}): ConfinementVerdict => {
  const location = request.importingPath.relative({ from: INSTALL_ROOT, to: request.specifier });
  return location.relation === "within-root" && request.reach.test(location.path) ? "allowed" : "outside";
};

export const relativeImportReaching = (request: {
  readonly importingFolder: string;
  readonly reach: RegExp;
}): ImportAllowance => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${request.importingFolder}`,
  });
  return ({ moduleImport }) =>
    RELATIVE_SPECIFIER.test(moduleImport.specifier)
      ? reachOf({ importingPath, reach: request.reach, specifier: moduleImport.specifier })
      : "outside";
};

const allowanceOf = (request: {
  readonly allowed: readonly ImportAllowance[];
  readonly moduleImport: ModuleImport;
}): ConfinementVerdict =>
  request.allowed.some((allows) => allows({ moduleImport: request.moduleImport }) === "allowed") ? "allowed" : "outside";

export const importsOutside = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowed: readonly ImportAllowance[];
}): readonly ImportOutside[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsIn({ file, text })
      .filter((moduleImport) => allowanceOf({ allowed: request.allowed, moduleImport }) === "outside")
      .map((moduleImport) => ({ file, ...moduleImport })),
  );

const folderOfSource = (request: { readonly source: string }): string =>
  request.source.replace(/^\.\//, "").split("/").slice(0, -1).join("/");

export const importsOutsideFromOwnFolder = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowedFrom: (request: { readonly importingFolder: string }) => readonly ImportAllowance[];
}): readonly ImportOutside[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsOutside({
      sources: { [file]: text },
      allowed: request.allowedFrom({ importingFolder: folderOfSource({ source: file }) }),
    }),
  );

const namingOf = (request: { readonly location: string; readonly importingFolder: string; readonly files: readonly string[] }): "names-a-file" | "names-none" =>
  request.files.some((file) => request.location === `${request.importingFolder}/${file}`) ? "names-a-file" : "names-none";

export const relativeImportNotNaming = (request: {
  readonly importingFolder: string;
  readonly files: readonly string[];
}): ImportAllowance => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${request.importingFolder}`,
  });
  return ({ moduleImport }) => {
    if (!RELATIVE_SPECIFIER.test(moduleImport.specifier)) {
      return "allowed";
    }
    const location = importingPath.relative({ from: INSTALL_ROOT, to: moduleImport.specifier });
    return location.relation === "within-root" && namingOf({ location: location.path, ...request }) === "names-a-file" ? "outside" : "allowed";
  };
};

const fileNameOfSource = (request: { readonly source: string }): string => request.source.split("/").at(-1) ?? "";

export const sourcesNamed = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => request.files.includes(fileNameOfSource({ source }))));

export const sourcesNotNamed = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => !request.files.includes(fileNameOfSource({ source }))));

export type ImportStatement = { readonly file: string; readonly statement: string };

const statementOf = (request: { readonly file: string; readonly found: ImportStatementIn }): ImportStatement => ({
  file: request.file,
  statement: request.found.statement,
});

export const importStatementsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ImportStatement[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importStatementsIn({ file, text })
      .filter((found) => request.specifier.test(found.specifier))
      .map((found) => statementOf({ file, found })),
  );

export type ImportFacts = ImportFactsIn & { readonly file: string };

export const importFactsReaching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly ImportFacts[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importFactsIn({ file, text })
      .filter((facts) => request.specifier.test(facts.specifier))
      .map((facts) => ({ file, ...facts })),
  );

const STATIC_FORMS_FOUND: readonly ModuleImport["form"][] = ["value", "type-only"];

export type UnfactedImports = {
  readonly file: string;
  readonly specifier: string;
  readonly found: number;
  readonly withFacts: number;
};

export const importsWithoutFacts = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly specifier: RegExp;
}): readonly UnfactedImports[] => {
  const facts = importFactsReaching(request);
  return Object.entries(request.sources).flatMap(([file, text]) => {
    const found = importsIn({ file, text }).filter(
      (moduleImport) => STATIC_FORMS_FOUND.includes(moduleImport.form) && request.specifier.test(moduleImport.specifier),
    );
    return [...new Set(found.map(({ specifier }) => specifier))].flatMap((specifier) => {
      const foundCount = found.filter((moduleImport) => moduleImport.specifier === specifier).length;
      const withFacts = facts.filter((fact) => fact.file === file && fact.specifier === specifier).length;
      return foundCount === withFacts ? [] : [{ file, specifier, found: foundCount, withFacts }];
    });
  });
};

type ImportGraph = ReadonlyMap<string, readonly string[]>;

const scannedImportsOf = (request: {
  readonly file: string;
  readonly text: string;
  readonly scanned: ReadonlySet<string>;
}): readonly string[] => {
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${folderOfSource({ source: request.file })}`,
  });
  return importsIn({ file: request.file, text: request.text })
    .filter(({ specifier }) => RELATIVE_SPECIFIER.test(specifier))
    .flatMap(({ specifier }) => {
      const location = importingPath.relative({ from: INSTALL_ROOT, to: specifier });
      return location.relation === "within-root" ? [`./${location.path}`] : [];
    })
    .filter((resolved) => request.scanned.has(resolved));
};

const reachedFrom = (request: {
  readonly graph: ImportGraph;
  readonly frontier: readonly string[];
  readonly seen: ReadonlySet<string>;
}): ReadonlySet<string> => {
  const fresh = [...new Set(request.frontier.flatMap((file) => request.graph.get(file) ?? []))].filter((file) => !request.seen.has(file));
  return fresh.length === 0 ? request.seen : reachedFrom({ graph: request.graph, frontier: fresh, seen: new Set([...request.seen, ...fresh]) });
};

export const filesReachableFrom = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly startingFrom: RegExp;
  readonly notEntering: RegExp;
}): readonly string[] => {
  const scanned = new Set(Object.keys(request.sources).filter((file) => !request.notEntering.test(file)));
  const graph: ImportGraph = new Map(
    [...scanned].map((file) => [file, scannedImportsOf({ file, text: request.sources[file] ?? "", scanned })]),
  );
  const starts = [...scanned].filter((file) => request.startingFrom.test(file));
  return [...reachedFrom({ graph, frontier: starts, seen: new Set(starts) })].sort();
};

export const sourcesOfFiles = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly files: readonly string[];
}): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([source]) => request.files.includes(source)));

export type ImportEdge = { readonly file: string; readonly specifier: string; readonly form: ModuleImport["form"] };

const resolvedImportOf = (request: { readonly file: string; readonly specifier: string }): string | undefined => {
  if (!RELATIVE_SPECIFIER.test(request.specifier)) {
    return undefined;
  }
  const importingPath = createPathPort({
    flavour: "posix",
    workingDirectory: () => `${INSTALL_ROOT}/${folderOfSource({ source: request.file })}`,
  });
  const location = importingPath.relative({ from: INSTALL_ROOT, to: request.specifier });
  return location.relation === "within-root" ? `./${location.path}` : undefined;
};

type FilesLeaving = {
  readonly sources: Readonly<Record<string, string>>;
  readonly startingFrom: RegExp;
  readonly notEntering: RegExp;
  readonly reaching: RegExp;
};

export const importEdgesLeaving = (request: FilesLeaving): readonly ImportEdge[] =>
  Object.entries(sourcesOfFiles({ sources: request.sources, files: filesReachableFrom(request) })).flatMap(([file, text]) =>
    importsIn({ file, text })
      .filter(({ specifier }) => request.reaching.test(resolvedImportOf({ file, specifier }) ?? ""))
      .map(({ specifier, form }) => ({ file, specifier, form })),
  );

export const importStatementsLeaving = (request: FilesLeaving): readonly ImportStatement[] =>
  Object.entries(sourcesOfFiles({ sources: request.sources, files: filesReachableFrom(request) })).flatMap(([file, text]) =>
    importStatementsIn({ file, text })
      .filter(({ specifier }) => request.reaching.test(resolvedImportOf({ file, specifier }) ?? ""))
      .map((found) => statementOf({ file, found })),
  );

export const unresolvedLoadsReached = (request: Omit<FilesLeaving, "reaching">): readonly ImportEdge[] =>
  Object.entries(sourcesOfFiles({ sources: request.sources, files: filesReachableFrom(request) })).flatMap(([file, text]) =>
    importsIn({ file, text })
      .filter(({ specifier, form }) => form === "dynamic" && !RELATIVE_SPECIFIER.test(specifier))
      .map(({ specifier, form }) => ({ file, specifier, form })),
  );

export const MODULE_EXTENSIONS = "{ts,mts,cts,tsx,js,mjs,cjs,jsx}";

const GLOBBED_EXTENSIONS = /\*\*\/\*\.(\{[^}]*\}|\w+)["']/g;

export const globExtensionsIn = (request: { readonly text: string }): readonly string[] => [
  ...new Set([...request.text.matchAll(GLOBBED_EXTENSIONS)].map(([, extensions]) => extensions ?? "")),
];

export const unscannedEdgesReached =(request: Omit<FilesLeaving, "reaching"> & { readonly within: RegExp }): readonly ImportEdge[] =>
  Object.entries(sourcesOfFiles({ sources: request.sources, files: filesReachableFrom(request) })).flatMap(([file, text]) =>
    importsIn({ file, text })
      .filter(({ specifier }) => {
        const resolved = resolvedImportOf({ file, specifier });
        return resolved !== undefined && request.within.test(resolved) && request.sources[resolved] === undefined;
      })
      .map(({ specifier, form }) => ({ file, specifier, form })),
  );

export const specifierImportsReached = (request: Omit<FilesLeaving, "reaching"> & { readonly specifier: RegExp }): readonly ImportEdge[] =>
  Object.entries(sourcesOfFiles({ sources: request.sources, files: filesReachableFrom(request) })).flatMap(([file, text]) =>
    importsIn({ file, text })
      .filter(({ specifier }) => request.specifier.test(specifier))
      .map(({ specifier, form }) => ({ file, specifier, form })),
  );

export const filesReachingExcept = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly startingFrom: RegExp;
  readonly reaching: RegExp;
  readonly exceptEdges: readonly ImportEdge[];
}): readonly string[] => {
  const scanned = new Set(Object.keys(request.sources));
  const exceptedFrom = (file: string): ReadonlySet<string | undefined> =>
    new Set(request.exceptEdges.filter((edge) => edge.file === file).map((edge) => resolvedImportOf(edge)));
  const graph: ImportGraph = new Map(
    Object.entries(request.sources).map(([file, text]) => [
      file,
      scannedImportsOf({ file, text, scanned }).filter((resolved) => !exceptedFrom(file).has(resolved)),
    ]),
  );
  return [...scanned]
    .filter((file) => request.startingFrom.test(file))
    .filter((file) => [...reachedFrom({ graph, frontier: [file], seen: new Set([file]) })].some((reached) => request.reaching.test(reached)))
    .sort();
};

export const outsideFiles = <Held extends { readonly file: string }>(request: {
  readonly held: readonly Held[];
  readonly files: RegExp;
}): readonly Held[] => request.held.filter(({ file }) => !request.files.test(file));

export const filesNotMatching = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly pattern: RegExp;
}): readonly string[] =>
  Object.entries(request.sources)
    .filter(([, text]) => !request.pattern.test(text))
    .map(([file]) => file);

const pathCallVerdict = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly observed: string;
  readonly paths: RegExp;
}): ConfinementVerdict => {
  const location = request.path.relative({ from: request.root, to: request.observed });
  return location.relation === "within-root" && request.paths.test(location.path) ? "allowed" : "outside";
};

export const pathCallsOutside = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly calls: readonly (readonly [{ readonly path: string }])[];
  readonly paths: RegExp;
}): PathCallsOutside => ({
  called: request.calls.length === 0 ? "never" : "at least once",
  outside: request.calls
    .map(([call]) => call.path)
    .filter((observed) => pathCallVerdict({ ...request, observed }) === "outside"),
});
