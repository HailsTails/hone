import { z } from "zod";

import type { Result } from "../../domain/result.ts";
import {
  type ConventionKey,
  type ConventionsReading,
  DEFAULT_CONVENTIONS,
  type GeneratedFiles,
  LAYER_NAMES,
  type LayerFolders,
  type LayerName,
} from "../../domain/settings/conventions.ts";
import type { TestFiles } from "../../domain/settings/test-files.ts";
import { brandedRepoPathSchema, repoPathTextSchema } from "../hone-records-folder/repo-path.ts";

const CONVENTION_KEYS: readonly ConventionKey[] = ["generated", "layers", "testFiles"];

const UNDER_A_NAMED_FOLDER = /^(?!\.\.?\/)[^*?[\]{}!/]+\//;

const generatedGlobsSchema = z
  .array(
    z.string().refine((glob) => UNDER_A_NAMED_FOLDER.test(glob), {
      error: "a generated entry names files under a named folder",
    }),
  )
  .min(1);

const generatedWireSchema = z
  .array(z.strictObject({ files: generatedGlobsSchema, outsideParty: z.string().min(1) }))
  .optional();

const NAME_PART = /^[\w-]+$/;

const namePartSchema = (request: { readonly refusal: string }) =>
  z.string().regex(NAME_PART, { error: request.refusal });

const SUFFIX_REFUSAL = "a test-file suffix is the name part before the extension";

const testFileSuffixSchema = namePartSchema({ refusal: SUFFIX_REFUSAL });

const firstTestFileSuffixSchema = z
  .string({ error: "testFiles names at least one suffix" })
  .regex(NAME_PART, { error: SUFFIX_REFUSAL });

const testFilesWireSchema = z
  .strictObject({
    suffixes: z.tuple([firstTestFileSuffixSchema], testFileSuffixSchema),
    folders: z.array(namePartSchema({ refusal: "a test folder is one folder name, not a path" })),
  })
  .optional();

const layerFolderSchema = brandedRepoPathSchema({
  text: repoPathTextSchema.refine((folder) => !folder.includes("*"), {
    error: "a layer lists folders git tracks, not globs",
  }),
});

const layerFoldersSchema = z.array(layerFolderSchema).min(1).optional();

const isInside = (request: {
  readonly folder: string;
  readonly outer: string;
}): "inside" | "apart" =>
  request.folder !== request.outer && request.folder.startsWith(`${request.outer}/`)
    ? "inside"
    : "apart";

const layersWireSchema = z
  .strictObject({
    domain: layerFoldersSchema,
    application: layerFoldersSchema,
    adapters: layerFoldersSchema,
  })
  .superRefine((layers, context) => {
    const folders = LAYER_NAMES.flatMap((layer) => layers[layer] ?? []);
    folders
      .filter((folder, index) => folders.indexOf(folder) !== index)
      .forEach((folder) => {
        context.addIssue({
          code: "custom",
          message: `${folder} is listed more than once; a folder belongs to one layer, once`,
        });
      });
    folders.forEach((folder) => {
      folders
        .filter((outer) => isInside({ folder, outer }) === "inside")
        .forEach((outer) => {
          context.addIssue({
            code: "custom",
            message: `${folder} is inside ${outer}; no layer folder sits inside another`,
          });
        });
    });
  });

const conventionsDocumentSchema = z.strictObject({
  generated: generatedWireSchema,
  layers: layersWireSchema,
  testFiles: testFilesWireSchema,
});

type ConventionsDocument = z.infer<typeof conventionsDocumentSchema>;

const layersOf = (request: {
  readonly layers: ConventionsDocument["layers"];
}): readonly LayerFolders[] =>
  LAYER_NAMES.flatMap((layer): readonly LayerFolders[] => {
    const folders = request.layers[layer];
    return folders === undefined ? [] : [{ layer, folders }];
  });

const conventionsReadingOf = (request: {
  readonly document: ConventionsDocument;
}): ConventionsReading => {
  const generated = request.document.generated;
  const layers = layersOf({ layers: request.document.layers });
  const testFiles = request.document.testFiles;
  const presence: Readonly<Record<ConventionKey, "declared" | "absent">> = {
    generated: generated === undefined ? "absent" : "declared",
    layers: layers.length === 0 ? "absent" : "declared",
    testFiles: testFiles === undefined ? "absent" : "declared",
  };
  const declared = CONVENTION_KEYS.filter((key) => presence[key] === "declared");
  return {
    conventions: {
      generated:
        generated === undefined
          ? DEFAULT_CONVENTIONS.generated
          : generated.map((entry) => ({ files: entry.files, outsideParty: entry.outsideParty })),
      layers,
      testFiles: testFiles ?? DEFAULT_CONVENTIONS.testFiles,
    },
    declared,
  };
};

export type ConventionsWire = {
  readonly generated?: readonly GeneratedFiles[];
  readonly layers?: Readonly<Partial<Record<LayerName, readonly string[]>>>;
  readonly testFiles?: TestFiles;
};

export const conventionsWireOf = (request: {
  readonly reading: ConventionsReading;
}): ConventionsWire => {
  const { conventions, declared } = request.reading;
  return {
    ...(declared.includes("generated") ? { generated: conventions.generated } : {}),
    ...(declared.includes("layers")
      ? {
          layers: Object.fromEntries(
            conventions.layers.map(
              ({ layer, folders }): readonly [LayerName, readonly string[]] => [layer, folders],
            ),
          ),
        }
      : {}),
    ...(declared.includes("testFiles") ? { testFiles: conventions.testFiles } : {}),
  };
};

export const conventionsOf = (request: {
  readonly document: unknown;
}): Result<ConventionsReading, string> => {
  const parsed = conventionsDocumentSchema.safeParse(request.document);
  return parsed.success
    ? { outcome: "ok", value: conventionsReadingOf({ document: parsed.data }) }
    : { outcome: "failed", error: z.prettifyError(parsed.error) };
};
