export const onOneLine = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

export const quoted = (request: { readonly text: string }): string =>
  onOneLine({ text: JSON.stringify(request.text) });

export const counted = (request: { readonly count: number; readonly noun: string }): string =>
  request.count === 1 ? `1 ${request.noun}` : `${request.count} ${request.noun}s`;
