import { type Node, parse, type ParseError, parseTree } from "jsonc-parser";

import type { Result } from "../../../../../domain/result.ts";

export type JsoncParsePort<Value = unknown> = {
  readonly parse: (request: {
    readonly source: string;
  }) => Result<Value, { readonly detail: string }>;
};

export type JsoncProviderCall<Value = unknown> = (request: { readonly source: string }) => {
  readonly value: Value;
  readonly errors: readonly ParseError[];
};

export const createJsoncParsePort = <Value>(options: {
  readonly parseProvider: JsoncProviderCall<Value>;
}): JsoncParsePort<Value> => ({
  parse: (request) => {
    try {
      const providerParse = options.parseProvider({ source: request.source });
      const firstDiagnostic = providerParse.errors[0];
      if (firstDiagnostic !== undefined) {
        return {
          outcome: "failed",
          error: {
            detail: `JSONC parse error ${firstDiagnostic.error} at offset ${firstDiagnostic.offset} (length ${firstDiagnostic.length})`,
          },
        };
      }
      return { outcome: "ok", value: providerParse.value };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: { detail: thrown instanceof Error ? thrown.message : String(thrown) },
      };
    }
  },
});

export type TrailingCommas = "allowed" | "refused";

const defaultProviderCallOf =
  (options: { readonly trailingCommas: TrailingCommas }): JsoncProviderCall =>
  (request) => {
    const errors: ParseError[] = [];
    const parsedValue: unknown = parse(request.source, errors, {
      allowTrailingComma: options.trailingCommas === "allowed",
    });
    return { value: parsedValue, errors };
  };

export const createDefaultJsoncParsePort = (options: {
  readonly trailingCommas: TrailingCommas;
}): JsoncParsePort =>
  createJsoncParsePort({
    parseProvider: defaultProviderCallOf(options),
  });

export type JsoncNode = Node;

export const createDefaultJsoncTreePort = (options: {
  readonly trailingCommas: TrailingCommas;
}): JsoncParsePort<JsoncNode | undefined> =>
  createJsoncParsePort({
    parseProvider: ({ source }) => {
      const errors: ParseError[] = [];
      const value = parseTree(source, errors, {
        allowTrailingComma: options.trailingCommas === "allowed",
      });
      return { value, errors };
    },
  });
