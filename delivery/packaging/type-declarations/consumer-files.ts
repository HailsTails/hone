import type { ConsumerContents, ConsumerText } from "./consumer-types-port.ts";
import type { ModuleFilesPort, ModulePathKind } from "./module-files-port.ts";

export const CONSUMER_ROOT = "/consumer";

type InstalledFolder = {
  readonly consumerPath: string;
  readonly diskPath: string;
  readonly nodeModules: string;
};

const mapPathToSlashes = (request: { readonly path: string }): string =>
  request.path.replaceAll("\\", "/");

const createPackagePath = (request: { readonly name: string }): string =>
  `${CONSUMER_ROOT}/node_modules/${request.name}`;

const createConsumerTexts = (contents: ConsumerContents): readonly ConsumerText[] => [
  ...contents.texts.map(({ path, text }) => ({ path: `${CONSUMER_ROOT}/${path}`, text })),
  ...contents.packages.flatMap((consumerPackage) =>
    consumerPackage.kind === "written"
      ? consumerPackage.texts.map(({ path, text }) => ({
          path: `${createPackagePath(consumerPackage)}/${path}`,
          text,
        }))
      : [],
  ),
];

const createInstalledFolders = (request: {
  readonly contents: ConsumerContents;
  readonly disk: ModuleFilesPort;
}): readonly InstalledFolder[] =>
  request.contents.packages.flatMap((consumerPackage) =>
    consumerPackage.kind === "installed"
      ? [
          {
            consumerPath: createPackagePath(consumerPackage),
            diskPath: `${mapPathToSlashes({ path: consumerPackage.nodeModules })}/${consumerPackage.folder}`,
            nodeModules: mapPathToSlashes({
              path: request.disk.resolvePath({ path: consumerPackage.nodeModules }),
            }),
          },
        ]
      : [],
  );

const mapPathToDisk = (request: {
  readonly path: string;
  readonly folders: readonly InstalledFolder[];
}): string | undefined => {
  const path = mapPathToSlashes(request);
  const linked = request.folders.find(({ consumerPath }) =>
    `${path}/`.startsWith(`${consumerPath}/`),
  );
  if (linked !== undefined) {
    return `${linked.diskPath}${path.slice(linked.consumerPath.length)}`;
  }
  return request.folders.some(({ nodeModules }) => path.startsWith(`${nodeModules}/`))
    ? path
    : undefined;
};

const readConsumerKind = (request: {
  readonly path: string;
  readonly texts: ReadonlyMap<string, string>;
  readonly consumerPaths: readonly string[];
}): ModulePathKind => {
  if (request.texts.has(request.path)) {
    return "file";
  }
  return request.consumerPaths.some((consumerPath) => consumerPath.startsWith(`${request.path}/`))
    ? "directory"
    : "absent";
};

export const createConsumerFiles = (request: {
  readonly contents: ConsumerContents;
  readonly disk: ModuleFilesPort;
}): ModuleFilesPort => {
  const { disk } = request;
  const texts = new Map(
    createConsumerTexts(request.contents).map(({ path, text }) => [path, text]),
  );
  const folders = createInstalledFolders(request);
  const consumerPaths = [...texts.keys(), ...folders.map(({ consumerPath }) => consumerPath)];
  return {
    readKind: ({ path }) => {
      const diskPath = mapPathToDisk({ path, folders });
      return diskPath === undefined
        ? readConsumerKind({ path, texts, consumerPaths })
        : disk.readKind({ path: diskPath });
    },
    readText: ({ path }) => {
      const diskPath = mapPathToDisk({ path, folders });
      return diskPath === undefined ? texts.get(path) : disk.readText({ path: diskPath });
    },
    resolvePath: ({ path }) => {
      const diskPath = mapPathToDisk({ path, folders });
      return diskPath === undefined ? path : disk.resolvePath({ path: diskPath });
    },
  };
};
