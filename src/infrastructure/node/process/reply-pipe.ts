export const REPLY_PIPE_DESCRIPTOR = 3;

export const readReplyPipe = (request: {
  readonly output: ReadonlyArray<string | null>;
}): string | undefined => {
  const reply = request.output[REPLY_PIPE_DESCRIPTOR];
  return typeof reply === "string" ? reply : undefined;
};

type StandardStream = "pipe" | "inherit";

export const openReplyPipe = (request: {
  readonly standardStreams: readonly [StandardStream, StandardStream, StandardStream];
}): [StandardStream, StandardStream, StandardStream, "pipe"] => [
  ...request.standardStreams,
  "pipe",
];
