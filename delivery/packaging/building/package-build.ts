import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import type { Result } from "../../../src/domain/result.ts";
import { packageFileStemOf, TOOL_IDENTITY } from "../../../src/domain/rule-set/tool-identity.ts";
import { catalogueClausesOf } from "../../../src/infrastructure/content-files/rule-sets/installed-pieces.ts";
import { createEngineBindingsRepository } from "../../../src/infrastructure/engines/piece-engines.ts";
import type { EntryDisposition } from "../../install-proof/install-proof-plan.ts";
import type { CopiedEntry, ScratchFilesPort } from "../../install-proof/install-proof-ports.ts";
import { CHANGELOG_FILE } from "../../release/changelog.ts";
import { cataloguePagesOf } from "../catalogue-pages/catalogue-pages.ts";
import { lockedDependenciesOf } from "../published-manifest/pnpm-lock.ts";
import {
  type DependencyRanges,
  dependencyRangesOf,
  packageVersionOf,
  peerKindsOf,
  peerNamesOf,
  publishManifestOf,
} from "../published-manifest/published-manifest.ts";
import {
  type DeclarationPort,
  declarationFilesOf,
  PUBLIC_TYPE_ENTRIES,
  typedExportOf,
} from "../type-declarations/package-declarations.ts";
import type { Bundle, BundlerPort } from "./esbuild-bundler-port.ts";
import {
  bundledPackageCodeOf,
  deadLinksOf,
  misplacedEntriesOf,
  undeclaredImportsOf,
  unlockedRangesOf,
  versionMentionsOf,
} from "./package-guards.ts";
import {
  documentAuthorOf,
  externalPackagesOf,
  type PackagePlan,
  type PieceText,
  packagePlanOf,
  piecePathsIn,
  SHIPPED_NODE_RANGE,
  SHIPPED_NODE_TARGET,
  TEST_FOLDERS,
} from "./package-plan.ts";

export type PackageBuildPorts = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly bundler: BundlerPort;
  readonly declarations: DeclarationPort;
};

export type BuiltPackage = { readonly outputRoot: string; readonly files: readonly string[] };

type BuildContext = PackageBuildPorts & {
  readonly packageRoot: string;
  readonly outputRoot: string;
};

type Built<Value> = Result<Value, string>;

type OutputFile = { readonly path: string; readonly text: string };

export const SOURCE_FOLDERS: readonly string[] = ["src", "rules", "methods", "docs"];

const BUNDLED_SOURCE_FOLDERS: readonly string[] = ["src", "rules"];

const BUNDLED_SOURCE_FILES: readonly string[] = [
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
];

export const LEFT_OUT_FOLDERS: ReadonlySet<string> = new Set([...TEST_FOLDERS, "node_modules"]);

const LEFT_OUT_FILE_SUFFIX = ".test.ts";

export const ROOT_FILES: readonly string[] = [
  "README.md",
  "ADOPTING.md",
  "MIGRATING.md",
  CHANGELOG_FILE,
  "LICENSE",
];

const MANIFEST = "package.json";

const INSTALL_LOCK: readonly string[] = ["pnpm-lock.yaml"];

const PACKAGE_FILE_STEM = packageFileStemOf({ packageName: TOOL_IDENTITY.packageName });

const STAGE_PREFIX = `${PACKAGE_FILE_STEM}-package-stage-`;

const STAGED_SOURCE = "source";

const failedWith = (request: {
  readonly label: string;
  readonly detail: string;
}): Built<never> => ({
  outcome: "failed",
  error: `FAIL: ${request.label}: ${request.detail}`,
});

const repositoryForm = (request: { readonly path: string }): string =>
  request.path.replaceAll("\\", "/");

const readText = (request: {
  readonly context: BuildContext;
  readonly path: string;
}): Built<string> => {
  const read = request.context.fileText.read({ path: request.path });
  return read.outcome === "failed"
    ? failedWith({ label: `read ${request.path}`, detail: read.error.detail })
    : read;
};

const sourceFilesUnder = (request: {
  readonly context: BuildContext;
  readonly folder: string;
}): Built<readonly string[]> => {
  const listed = request.context.scratch.listTree({
    path: request.context.path.join({ segments: [request.context.packageRoot, request.folder] }),
  });
  if (listed.outcome === "failed") {
    return failedWith({ label: `list ${request.folder}`, detail: listed.error.detail });
  }
  return {
    outcome: "ok",
    value: listed.value
      .filter((entry) => entry.entryKind === "file")
      .map((entry) => `${request.folder}/${repositoryForm({ path: entry.path })}`),
  };
};

const presentRootFiles = (request: { readonly context: BuildContext }): readonly string[] =>
  ROOT_FILES.filter(
    (name) =>
      request.context.fileText.exists({
        path: request.context.path.join({ segments: [request.context.packageRoot, name] }),
      }) === "present",
  );

const allOk = <Value>(request: {
  readonly results: readonly Built<Value>[];
}): Built<readonly Value[]> =>
  request.results.reduce<Built<readonly Value[]>>(
    (sofar, next) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      return next.outcome === "failed"
        ? next
        : { outcome: "ok", value: [...sofar.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

const sourcePathsOf = (request: { readonly context: BuildContext }): Built<readonly string[]> => {
  const listed = allOk({
    results: SOURCE_FOLDERS.map((folder) => sourceFilesUnder({ context: request.context, folder })),
  });
  return listed.outcome === "failed"
    ? listed
    : { outcome: "ok", value: [...presentRootFiles(request), ...listed.value.flat()] };
};

const sourceFile = (request: { readonly context: BuildContext; readonly path: string }): string =>
  request.context.path.join({
    segments: [request.context.packageRoot, ...request.path.split("/")],
  });

const pieceTextsOf = (request: {
  readonly context: BuildContext;
  readonly sourcePaths: readonly string[];
}): Built<readonly PieceText[]> =>
  allOk({
    results: piecePathsIn({ sourcePaths: request.sourcePaths }).map((path) => {
      const text = readText({
        context: request.context,
        path: sourceFile({ context: request.context, path }),
      });
      return text.outcome === "failed"
        ? text
        : { outcome: "ok", value: { path, text: text.value } };
    }),
  });

const planOf = (request: { readonly context: BuildContext }): Built<PackagePlan> => {
  const sourcePaths = sourcePathsOf(request);
  if (sourcePaths.outcome === "failed") {
    return sourcePaths;
  }
  const pieces = pieceTextsOf({ context: request.context, sourcePaths: sourcePaths.value });
  if (pieces.outcome === "failed") {
    return pieces;
  }
  const plan = packagePlanOf({ sourcePaths: sourcePaths.value, pieces: pieces.value });
  return plan.outcome === "failed"
    ? failedWith({ label: `plan ${plan.error.path}`, detail: plan.error.detail })
    : plan;
};

const stagedDisposition = (entry: CopiedEntry): EntryDisposition => {
  if (entry.entryKind === "folder") {
    return LEFT_OUT_FOLDERS.has(entry.name) ? "left-out" : "kept";
  }
  return entry.name.endsWith(LEFT_OUT_FILE_SUFFIX) ? "left-out" : "kept";
};

const stagedTree = (request: {
  readonly context: BuildContext;
  readonly from: string;
  readonly to: string;
  readonly disposition: (entry: CopiedEntry) => EntryDisposition;
}): Built<null> => {
  const copied = request.context.scratch.copyTree({
    from: request.from,
    to: request.to,
    disposition: request.disposition,
  });
  return copied.outcome === "failed"
    ? failedWith({ label: `stage ${request.from}`, detail: copied.error.detail })
    : copied;
};

const stagedFile = (request: {
  readonly context: BuildContext;
  readonly sourceRoot: string;
  readonly name: string;
}): Built<null> => {
  const text = readText({
    context: request.context,
    path: sourceFile({ context: request.context, path: request.name }),
  });
  if (text.outcome === "failed") {
    return text;
  }
  const written = request.context.fileText.write({
    path: request.context.path.join({ segments: [request.sourceRoot, request.name] }),
    text: text.value,
  });
  return written.outcome === "failed"
    ? failedWith({ label: `stage ${request.name}`, detail: written.error.detail })
    : { outcome: "ok", value: null };
};

const stagedSource = (request: {
  readonly context: BuildContext;
  readonly sourceRoot: string;
}): Built<readonly null[]> =>
  allOk({
    results: [
      ...BUNDLED_SOURCE_FOLDERS.map((folder) =>
        stagedTree({
          context: request.context,
          from: sourceFile({ context: request.context, path: folder }),
          to: request.context.path.join({ segments: [request.sourceRoot, folder] }),
          disposition: stagedDisposition,
        }),
      ),
      ...BUNDLED_SOURCE_FILES.map((name) =>
        stagedFile({ context: request.context, sourceRoot: request.sourceRoot, name }),
      ),
    ],
  });

const failedOnProblems = (request: {
  readonly label: string;
  readonly problems: readonly string[];
}): Built<null> =>
  request.problems.length === 0
    ? { outcome: "ok", value: null }
    : failedWith({ label: request.label, detail: request.problems.join("; ") });

type Declared = { readonly peers: readonly string[]; readonly ranges: DependencyRanges };

const declaredPackagesOf = (request: Declared): readonly string[] => [
  ...request.peers,
  ...Object.keys(request.ranges),
];

const checkedBundle = (request: {
  readonly plan: PackagePlan;
  readonly declared: readonly string[];
  readonly bundle: Bundle;
}): Built<Bundle> => {
  const undeclared = failedOnProblems({
    label:
      "bundle: an output imports what is neither a node: builtin, a declared peer nor a declared dependency",
    problems: undeclaredImportsOf({ outputs: request.bundle.outputs, declared: request.declared }),
  });
  if (undeclared.outcome === "failed") {
    return undeclared;
  }
  const carried = failedOnProblems({
    label:
      "bundle: an output carries an installed package's code, which the package imports by name instead",
    problems: bundledPackageCodeOf({ packageRoots: request.bundle.packageRoots }),
  });
  if (carried.outcome === "failed") {
    return carried;
  }
  const misplaced = failedOnProblems({
    label: "bundle: an entry would not find the install root from its own module",
    problems: misplacedEntriesOf({
      entryPoints: request.plan.entryPoints,
      outputs: request.bundle.outputs,
    }),
  });
  return misplaced.outcome === "failed" ? misplaced : { outcome: "ok", value: request.bundle };
};

const bundleOf = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly declared: readonly string[];
  readonly sourceRoot: string;
}): Promise<Built<Bundle>> =>
  request.context.bundler
    .bundle({
      sourceRoot: request.sourceRoot,
      entryPoints: request.plan.entryPoints,
      external: externalPackagesOf({ packages: request.declared }),
      target: SHIPPED_NODE_TARGET,
    })
    .then((bundle): Built<Bundle> =>
      bundle.outcome === "failed"
        ? failedWith({ label: "bundle", detail: bundle.error.detail })
        : checkedBundle({ plan: request.plan, declared: request.declared, bundle: bundle.value }),
    );

const lockedRangesOf = (request: {
  readonly context: BuildContext;
  readonly ranges: DependencyRanges;
}): Built<DependencyRanges> => {
  const lockPath = sourceFile({ context: request.context, path: INSTALL_LOCK.join("/") });
  const lockText = readText({ context: request.context, path: lockPath });
  if (lockText.outcome === "failed") {
    return lockText;
  }
  const locked = lockedDependenciesOf({
    lockText: lockText.value,
    dependencies: Object.keys(request.ranges),
  });
  if (locked.outcome === "failed") {
    return failedWith({ label: `read ${lockPath}`, detail: locked.error });
  }
  const checked = failedOnProblems({
    label: `the published dependency ranges do not start at the versions ${INSTALL_LOCK.join("/")} locks`,
    problems: unlockedRangesOf({ ranges: request.ranges, locked: locked.value }),
  });
  return checked.outcome === "failed" ? checked : { outcome: "ok", value: request.ranges };
};

const bundledInStage = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly declared: readonly string[];
  readonly sourceRoot: string;
}): Promise<Built<Bundle>> => {
  const staged = stagedSource(request);
  return staged.outcome === "failed" ? Promise.resolve(staged) : bundleOf(request);
};

const stagedBundleOf = async (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly declared: readonly string[];
}): Promise<Built<Bundle>> => {
  const stage = request.context.scratch.createTemporaryDirectory({ prefix: STAGE_PREFIX });
  if (stage.outcome === "failed") {
    return failedWith({ label: "create the bundling stage", detail: stage.error.detail });
  }
  const bundled = await bundledInStage({
    ...request,
    sourceRoot: request.context.path.join({ segments: [stage.value, STAGED_SOURCE] }),
  });
  const removed = request.context.scratch.removeTree({ path: stage.value });
  return bundled.outcome === "ok" && removed.outcome === "failed"
    ? failedWith({ label: `remove ${stage.value}`, detail: removed.error.detail })
    : bundled;
};

const copiedFilesOf = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
}): Built<readonly OutputFile[]> =>
  allOk({
    results: request.plan.copied.map((path) => {
      const text = readText({
        context: request.context,
        path: sourceFile({ context: request.context, path }),
      });
      return text.outcome === "failed"
        ? text
        : { outcome: "ok", value: { path, text: text.value } };
    }),
  });

const topLevelNames = (request: { readonly files: readonly OutputFile[] }): readonly string[] =>
  [...new Set(request.files.map((file) => file.path.split("/")[0]))].sort();

const contentFilesOf = (request: {
  readonly context: BuildContext;
  readonly plan: PackagePlan;
  readonly bundle: Bundle;
}): Built<readonly OutputFile[]> => {
  const copied = copiedFilesOf(request);
  if (copied.outcome === "failed") {
    return copied;
  }
  const sourceRoot = request.context.path.resolve({ path: request.context.packageRoot });
  if (sourceRoot.outcome === "failed") {
    return failedWith({ label: "resolve the package root", detail: sourceRoot.error.path });
  }
  const pages = cataloguePagesOf({
    files: copied.value,
    engineBindings: createEngineBindingsRepository({
      fileText: request.context.fileText,
      path: request.context.path,
      ruleSetRoot: sourceRoot.value,
      installRoot: sourceRoot.value,
    }),
    clauses: {
      read: ({ names }) =>
        catalogueClausesOf({
          fileText: request.context.fileText,
          path: request.context.path,
          installRoot: sourceRoot.value,
          names,
        }),
    },
    path: request.context.path,
  });
  if (pages.outcome === "failed") {
    return failedWith({ label: "render the catalogue pages", detail: pages.error });
  }
  return {
    outcome: "ok",
    value: [
      ...request.bundle.outputs.map(({ path, text }) => ({ path, text })),
      ...copied.value,
      ...pages.value,
      ...request.plan.pieces,
    ],
  };
};

const withManifest = (request: {
  readonly plan: PackagePlan;
  readonly developmentManifest: string;
  readonly files: readonly OutputFile[];
}): Built<readonly OutputFile[]> => {
  const manifest = publishManifestOf({
    developmentManifest: request.developmentManifest,
    identity: TOOL_IDENTITY,
    command: request.plan.command,
    files: topLevelNames({ files: request.files }),
    exported: request.plan.exported,
    typed: PUBLIC_TYPE_ENTRIES.map((entry) => typedExportOf({ entry })),
    nodeRange: SHIPPED_NODE_RANGE,
  });
  return manifest.outcome === "failed"
    ? failedWith({ label: "publish manifest", detail: manifest.error.detail })
    : { outcome: "ok", value: [{ path: MANIFEST, text: manifest.value }, ...request.files] };
};

const linkedFiles = (request: {
  readonly files: readonly OutputFile[];
  readonly version: string;
}): Built<readonly OutputFile[]> => {
  const linked = failedOnProblems({
    label: "a shipped page links to a file the package does not ship",
    problems: deadLinksOf({ files: request.files }),
  });
  if (linked.outcome === "failed") {
    return linked;
  }
  const versioned = failedOnProblems({
    label: "a shipped page names a Hone version, which goes stale on the next release",
    problems: versionMentionsOf({
      files: request.files.filter((file) => documentAuthorOf(file) === "maintainer"),
      tarballStem: PACKAGE_FILE_STEM,
      version: request.version,
    }),
  });
  return versioned.outcome === "failed" ? versioned : { outcome: "ok", value: request.files };
};

const writtenFile = (request: {
  readonly context: BuildContext;
  readonly file: OutputFile;
}): Built<string> => {
  const target = request.context.path.join({
    segments: [request.context.outputRoot, ...request.file.path.split("/")],
  });
  const directory = request.context.scratch.makeDirectory({
    path: request.context.path.directoryOf({ path: target }),
  });
  if (directory.outcome === "failed") {
    return failedWith({
      label: `create the folder of ${request.file.path}`,
      detail: directory.error.detail,
    });
  }
  const written = request.context.fileText.write({ path: target, text: request.file.text });
  return written.outcome === "failed"
    ? failedWith({ label: `write ${request.file.path}`, detail: written.error.detail })
    : { outcome: "ok", value: request.file.path };
};

const writtenPackage = (request: {
  readonly context: BuildContext;
  readonly files: readonly OutputFile[];
}): Built<BuiltPackage> => {
  const cleared = request.context.scratch.removeTree({ path: request.context.outputRoot });
  if (cleared.outcome === "failed") {
    return failedWith({
      label: `clear ${request.context.outputRoot}`,
      detail: cleared.error.detail,
    });
  }
  const written = allOk({
    results: request.files.map((file) => writtenFile({ context: request.context, file })),
  });
  return written.outcome === "failed"
    ? written
    : {
        outcome: "ok",
        value: { outputRoot: request.context.outputRoot, files: [...written.value].sort() },
      };
};

const publishedDeclarationsIn = (request: {
  readonly context: BuildContext;
  readonly developmentManifest: string;
}): Promise<Built<readonly OutputFile[]>> => {
  const peers = peerKindsOf({ developmentManifest: request.developmentManifest });
  return peers.outcome === "failed"
    ? Promise.resolve(failedWith({ label: MANIFEST, detail: peers.error.detail }))
    : declarationFilesOf({
        port: request.context.declarations,
        sourceRoot: request.context.packageRoot,
        entries: PUBLIC_TYPE_ENTRIES,
        requiredPeers: Object.keys(peers.value).filter((peer) => peers.value[peer] === "required"),
      });
};

const packageFilesOf = async (request: {
  readonly context: BuildContext;
}): Promise<Built<readonly OutputFile[]>> => {
  const plan = planOf(request);
  if (plan.outcome === "failed") {
    return plan;
  }
  const developmentManifest = readText({
    context: request.context,
    path: sourceFile({ context: request.context, path: MANIFEST }),
  });
  if (developmentManifest.outcome === "failed") {
    return developmentManifest;
  }
  const peers = peerNamesOf({ developmentManifest: developmentManifest.value });
  if (peers.outcome === "failed") {
    return failedWith({ label: MANIFEST, detail: peers.error.detail });
  }
  const ranges = dependencyRangesOf({ developmentManifest: developmentManifest.value });
  if (ranges.outcome === "failed") {
    return failedWith({ label: MANIFEST, detail: ranges.error.detail });
  }
  const locked = lockedRangesOf({ context: request.context, ranges: ranges.value });
  if (locked.outcome === "failed") {
    return locked;
  }
  const version = packageVersionOf({ developmentManifest: developmentManifest.value });
  if (version.outcome === "failed") {
    return failedWith({ label: MANIFEST, detail: version.error.detail });
  }
  const bundle = await stagedBundleOf({
    context: request.context,
    plan: plan.value,
    declared: declaredPackagesOf({ peers: peers.value, ranges: locked.value }),
  });
  if (bundle.outcome === "failed") {
    return bundle;
  }
  const files = contentFilesOf({
    context: request.context,
    plan: plan.value,
    bundle: bundle.value,
  });
  if (files.outcome === "failed") {
    return files;
  }
  const declarations = await publishedDeclarationsIn({
    context: request.context,
    developmentManifest: developmentManifest.value,
  });
  if (declarations.outcome === "failed") {
    return declarations;
  }
  const manifested = withManifest({
    plan: plan.value,
    developmentManifest: developmentManifest.value,
    files: [...files.value, ...declarations.value],
  });
  return manifested.outcome === "failed"
    ? manifested
    : linkedFiles({ files: manifested.value, version: version.value });
};

export const buildPackage = async (request: {
  readonly ports: PackageBuildPorts;
  readonly packageRoot: string;
  readonly outputRoot: string;
}): Promise<Built<BuiltPackage>> => {
  const context: BuildContext = {
    ...request.ports,
    packageRoot: request.packageRoot,
    outputRoot: request.outputRoot,
  };
  const files = await packageFilesOf({ context });
  return files.outcome === "failed" ? files : writtenPackage({ context, files: files.value });
};
