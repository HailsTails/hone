export const codePointOrder = (request: {
  readonly left: string;
  readonly right: string;
}): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};
