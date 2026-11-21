import { z } from "zod";
import { brandedRepoPathSchema, repoPathTextSchema } from "../hone-records-folder/repo-path.ts";
import {
  type ConventionKey,
  type ConventionsReading,
  DEFAULT_CONVENTIONS,
  type GeneratedFiles,
  LAYER_NAMES,
  type LayerFolders,
  type LayerName,
} from "../../domain/settings/conventions.ts";
import type { Result } from "../../domain/result.ts";

const CONVENTION_KEYS: readonly ConventionKey[] = ["generated", "layers"];

const UNDER_A_NAMED_FOLDER = /^(?!\.\.?\/)[^*?[\]{}!/]+\//;

const generatedGlobsSchema = z
  .array(z.string().refine((glob) => UNDER_A_NAMED_FOLDER.test(glob), { error: "a generated entry names files under a named folder" }))
  .min(1);

const generatedWireSchema = z.array(z.strictObject({ files: generatedGlobsSchema, outsideParty: z.string().min(1) })).optional();

const layerFolderSchema = brandedRepoPathSchema({
  text: repoPathTextSchema.refine((folder) => !folder.includes("*"), { error: "a layer lists folders git tracks, not globs" }),
});

const layerFoldersSchema = z.array(layerFolderSchema).min(1).optional();

const isInside = (request: { readonly folder: string; readonly outer: string }): "inside" | "apart" =>
  request.folder !== request.outer && request.folder.startsWith(`${request.outer}/`) ? "inside" : "apart";

const layersWireSchema = z
  .strictObject({ domain: layerFoldersSchema, application: layerFoldersSchema, adapters: layerFoldersSchema })
  .superRefine((layers, context) => {
    const folders = LAYER_NAMES.flatMap((layer) => layers[layer] ?? []);
    folders
      .filter((folder, index) => folders.indexOf(folder) !== index)
      .forEach((folder) => {
        context.addIssue({ code: "custom", message: `${folder} is listed more than once; a folder belongs to one layer, once` });
      });
    folders.forEach((folder) => {
      folders
        .filter((outer) => isInside({ folder, outer }) === "inside")
        .forEach((outer) => {
          context.addIssue({ code: "custom", message: `${folder} is inside ${outer}; no layer folder sits inside another` });
        });
    });
  });

const conventionsDocumentSchema = z.strictObject({ generated: generatedWireSchema, layers: layersWireSchema });

type ConventionsDocument = z.infer<typeof conventionsDocumentSchema>;

const layersOf = (request: { readonly layers: ConventionsDocument["layers"] }): readonly LayerFolders[] =>
  LAYER_NAMES.flatMap((layer): readonly LayerFolders[] => {
    const folders = request.layers[layer];
    return folders === undefined ? [] : [{ layer, folders }];
  });

const conventionsReadingOf = (request: { readonly document: ConventionsDocument }): ConventionsReading => {
  const generated = request.document.generated;
  const layers = layersOf({ layers: request.document.layers });
  const presence: Readonly<Record<ConventionKey, "declared" | "absent">> = {
    generated: generated === undefined ? "absent" : "declared",
    layers: layers.length === 0 ? "absent" : "declared",
  };
  const declared = CONVENTION_KEYS.filter((key) => presence[key] === "declared");
  return {
    conventions: {
      generated: generated === undefined ? DEFAULT_CONVENTIONS.generated : generated.map((entry) => ({ files: entry.files, outsideParty: entry.outsideParty })),
      layers,
    },
    declared,
  };
};

export type ConventionsWire = {
  readonly generated?: readonly GeneratedFiles[];
  readonly layers?: Readonly<Partial<Record<LayerName, readonly string[]>>>;
};

export const conventionsWireOf = (request: { readonly reading: ConventionsReading }): ConventionsWire => {
  const { conventions, declared } = request.reading;
  return {
    ...(declared.includes("generated") ? { generated: conventions.generated } : {}),
    ...(declared.includes("layers")
      ? { layers: Object.fromEntries(conventions.layers.map(({ layer, folders }): readonly [LayerName, readonly string[]] => [layer, folders])) }
      : {}),
  };
};

export const conventionsOf = (request: { readonly document: unknown }): Result<ConventionsReading, string> => {
  const parsed = conventionsDocumentSchema.safeParse(request.document);
  return parsed.success ? { outcome: "ok", value: conventionsReadingOf({ document: parsed.data }) } : { outcome: "failed", error: z.prettifyError(parsed.error) };
};
