import type { RepoPath } from "../repository/repo-path-types.ts";

export type GeneratedFiles = { readonly files: readonly string[]; readonly outsideParty: string };

export const LAYER_NAMES = ["domain", "application", "adapters"] as const;

export type LayerName = (typeof LAYER_NAMES)[number];

export type LayerFolders = { readonly layer: LayerName; readonly folders: readonly RepoPath[] };

export type Conventions = { readonly generated: readonly GeneratedFiles[]; readonly layers: readonly LayerFolders[] };

export type ConventionKey = "generated" | "layers";

export type ConventionsReading = { readonly conventions: Conventions; readonly declared: readonly ConventionKey[] };

export const DEFAULT_CONVENTIONS: Conventions = { generated: [], layers: [] };
