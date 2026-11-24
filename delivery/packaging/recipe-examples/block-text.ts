import { repoPathOf } from "../../../src/domain/repository/repo-path-of.ts";
import type { ExampleBlock } from "./example-block.ts";

export const BLOCK_FILE = repoPathOf("recipe-example.test.ts");

const VITEST_IMPORT = 'import { assert, expect, it, vi } from "vitest";\n';

export const createBlockText = (request: { readonly source: string }): string =>
  `${VITEST_IMPORT}${request.source}`;

export const createTestText = (request: { readonly source: string }): string =>
  createBlockText({ source: `it("example", () => {\n${request.source}\n});` });

export const createBlockName = (request: { readonly block: ExampleBlock }): string =>
  `${request.block.recipe}#${request.block.anchor} ${request.block.position}`;
