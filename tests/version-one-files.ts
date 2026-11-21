import type { ExceptionsFile } from "../src/domain/records/discipline-exceptions/exception-record.ts";

const VERSION_ONE = 1;

const JSON_INDENT = 2;

export const selectionTextOf = (request: { readonly clauses: Readonly<Record<string, string>> }): string =>
  `${JSON.stringify({ version: VERSION_ONE, ruleSets: {}, clauses: request.clauses }, null, JSON_INDENT)}\n`;

export const exceptionsTextOf = (request: { readonly exceptions: ExceptionsFile["exceptions"] }): string =>
  `${JSON.stringify({ version: VERSION_ONE, exceptions: request.exceptions }, null, JSON_INDENT)}\n`;
