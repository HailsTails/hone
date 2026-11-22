const LINE_COMMENT = "//";

const BLOCK_OPEN = "/*";

const BLOCK_CLOSE = "*/";

export const commentValueOf = (request: { readonly text: string }): string => {
  if (request.text.startsWith(LINE_COMMENT)) {
    return request.text.slice(LINE_COMMENT.length);
  }
  return request.text.startsWith(BLOCK_OPEN) && request.text.endsWith(BLOCK_CLOSE)
    ? request.text.slice(BLOCK_OPEN.length, -BLOCK_CLOSE.length)
    : request.text;
};
