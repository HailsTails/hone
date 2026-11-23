import { type Node, parse, type ParseError, parseTree } from "jsonc-parser";

import type { Result } from "../../../../../domain/result.ts";

export type JsoncParsePort<Value> = {
  readonly parse: (request: {
    readonly source: string;
  }) => Result<Value, { readonly detail: string }>;
};

export type JsoncProviderCall<Value> = (request: { readonly source: string }) => {
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
  <Value>(options: {
    readonly trailingCommas: TrailingCommas;
    readonly read: (...arguments_: Parameters<typeof parseTree>) => Value;
  }): JsoncProviderCall<Value> =>
  (request) => {
    const errors: ParseError[] = [];
    const parsedValue = options.read(request.source, errors, {
      allowTrailingComma: options.trailingCommas === "allowed",
    });
    return { value: parsedValue, errors };
  };

export const createDefaultJsoncParsePort = (options: {
  readonly trailingCommas: TrailingCommas;
}): JsoncParsePort<unknown> =>
  createJsoncParsePort({
    parseProvider: defaultProviderCallOf<unknown>({ ...options, read: parse }),
  });

export type JsoncNode = Node;

export const createDefaultJsoncTreePort = (options: {
  readonly trailingCommas: TrailingCommas;
}): JsoncParsePort<JsoncNode | undefined> =>
  createJsoncParsePort({
    parseProvider: defaultProviderCallOf({ ...options, read: parseTree }),
  });
