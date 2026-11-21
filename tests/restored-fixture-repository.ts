import type { FileTextPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import type { PathPort } from "../src/infrastructure/node/path-port.ts";
import type { AbsolutePath } from "../src/infrastructure/content-files/absolute-path.ts";
import type { ListedEntry, ScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import type { ScratchRepositories } from "./scratch-repositories.ts";

export const STORED_LINT_CONFIG_NAME = "lint-config.fixture";

const RESTORED_LINT_CONFIG_NAME = "eslint.config.mjs";

const MODULE_FILE = /\.mjs$/;

const RELATIVE_IMPORT = /from "(\.\.?\/[^"]*)"/g;

const SAME_FOLDER_MARK = "./";

export type RehomedImports = {
  readonly text: string;
  readonly path: Pick<PathPort, "join" | "relative">;
  readonly fixtureRoot: string;
  readonly from: string;
  readonly to: string;
};

const OUTSIDE_THE_ROOT = "..";

const OUTSIDE_THE_ROOT_PREFIX = `${OUTSIDE_THE_ROOT}/`;

const leavesTheRoot = (request: { readonly path: string }): "leaves" | "stays" =>
  request.path === OUTSIDE_THE_ROOT || request.path.startsWith(OUTSIDE_THE_ROOT_PREFIX) ? "leaves" : "stays";

const placeOfTarget = (request: Omit<RehomedImports, "text"> & { readonly target: string }): "inside-the-fixture" | "outside-the-fixture" => {
  const inside = request.path.relative({ from: request.fixtureRoot, to: request.target });
  return inside.relation === "within-root" && leavesTheRoot({ path: inside.path }) === "stays" ? "inside-the-fixture" : "outside-the-fixture";
};

const rehomedSpecifier = (request: Omit<RehomedImports, "text"> & { readonly specifier: string }): string => {
  const target = request.path.join({ segments: [request.from, request.specifier] });
  if (placeOfTarget({ ...request, target }) === "inside-the-fixture") {
    return request.specifier;
  }
  const location = request.path.relative({ from: request.to, to: target });
  if (location.relation === "different-root") {
    return target;
  }
  return location.path.startsWith(".") ? location.path : `${SAME_FOLDER_MARK}${location.path}`;
};

export const rehomedImports = (request: RehomedImports): string =>
  request.text.replace(RELATIVE_IMPORT, (_whole, specifier: string) => `from "${rehomedSpecifier({ ...request, specifier })}"`);

type Dependencies = {
  readonly repositories: ScratchRepositories;
  readonly scratch: ScratchFilesPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
};

type EntryRequest = Dependencies & {
  readonly fixtureRoot: AbsolutePath;
  readonly repo: AbsolutePath;
  readonly entry: ListedEntry;
};

const slashed = (request: { readonly path: string }): string => request.path.replaceAll("\\", "/");

const restoredName = (request: { readonly name: string }): string =>
  request.name === STORED_LINT_CONFIG_NAME ? RESTORED_LINT_CONFIG_NAME : request.name;

const restoredLocation = (request: { readonly entry: ListedEntry }): string => {
  const shown = slashed({ path: request.entry.path });
  const folder = shown.slice(0, shown.length - request.entry.name.length);
  return `${folder}${restoredName({ name: request.entry.name })}`;
};

const failed = (request: { readonly what: string; readonly detail: string }): never => {
  throw new Error(`${request.what}: ${request.detail}`);
};

const copiedFolder = (request: EntryRequest): void => {
  const made = request.scratch.makeDirectory({ path: `${request.repo}/${slashed({ path: request.entry.path })}` });
  if (made.outcome !== "ok") {
    failed({ what: `a fixture folder could not be made for ${request.entry.path}`, detail: made.error.detail });
  }
};

const textOf = (request: EntryRequest): string => {
  const read = request.fileText.read({ path: `${request.fixtureRoot}/${slashed({ path: request.entry.path })}` });
  return read.outcome === "ok" ? read.value : failed({ what: `a fixture file could not be read at ${request.entry.path}`, detail: read.error.detail });
};

const restoredText = (request: EntryRequest): string => {
  const text = textOf(request);
  if (!MODULE_FILE.test(restoredName({ name: request.entry.name }))) {
    return text;
  }
  const folder = request.path.directoryOf({ path: slashed({ path: request.entry.path }) });
  return rehomedImports({
    text,
    path: request.path,
    fixtureRoot: request.fixtureRoot,
    from: request.path.join({ segments: [request.fixtureRoot, folder] }),
    to: request.path.join({ segments: [request.repo, folder] }),
  });
};

const copiedFile = (request: EntryRequest): void => {
  const target = `${request.repo}/${restoredLocation({ entry: request.entry })}`;
  const written = request.fileText.write({ path: target, text: restoredText(request) });
  if (written.outcome !== "ok") {
    failed({ what: `a fixture file could not be written at ${target}`, detail: written.error.detail });
  }
};

const copiedEntry = (request: EntryRequest): void => {
  if (request.entry.entryKind === "folder") {
    copiedFolder(request);
    return;
  }
  copiedFile(request);
};

export type TextFiles = Readonly<Record<string, string>>;

export const NO_TEXT_FILES: TextFiles = {};

export type RestoredFixture = { readonly fixtureRoot: AbsolutePath; readonly textFiles: TextFiles };

export type RestoredFixtureRepositories = {
  readonly restoredFrom: (request: RestoredFixture) => AbsolutePath;
};

const writtenText = (request: Dependencies & { readonly repo: AbsolutePath; readonly file: string; readonly text: string }): void => {
  const target = `${request.repo}/${request.file}`;
  const made = request.scratch.makeDirectory({ path: request.path.directoryOf({ path: target }) });
  if (made.outcome !== "ok") {
    failed({ what: `a folder for the fixture text could not be made for ${request.file}`, detail: made.error.detail });
  }
  const written = request.fileText.write({ path: target, text: request.text });
  if (written.outcome !== "ok") {
    failed({ what: `a fixture text could not be written at ${target}`, detail: written.error.detail });
  }
};

const restoredOnce = (request: Dependencies & RestoredFixture): AbsolutePath => {
  const listed = request.scratch.listTree({ path: request.fixtureRoot });
  if (listed.outcome !== "ok") {
    return failed({ what: `the fixture at ${request.fixtureRoot} could not be listed`, detail: listed.error.detail });
  }
  const repo = request.repositories.repositoryWith({ files: {} });
  const folders = listed.value.filter(({ entryKind }) => entryKind === "folder");
  const files = listed.value.filter(({ entryKind }) => entryKind === "file");
  [...folders, ...files].forEach((entry) => {
    copiedEntry({ ...request, repo, entry });
  });
  Object.entries(request.textFiles).forEach(([file, text]) => {
    writtenText({ ...request, repo, file, text });
  });
  const resolved = request.path.resolve({ path: repo });
  return resolved.outcome === "ok" ? resolved.value : failed({ what: `the restored repository at ${repo} has no absolute path`, detail: resolved.error.path });
};

export const restoredFixtureRepositoriesOver = (dependencies: Dependencies): RestoredFixtureRepositories => {
  const restoredByFixture = new Map<string, AbsolutePath>();
  return {
    restoredFrom: (fixture) => {
      const key = JSON.stringify([fixture.fixtureRoot, fixture.textFiles]);
      const known = restoredByFixture.get(key);
      if (known !== undefined) {
        return known;
      }
      const repo = restoredOnce({ ...dependencies, ...fixture });
      restoredByFixture.set(key, repo);
      return repo;
    },
  };
};
