const withoutOne = (request: { readonly from: readonly string[]; readonly key: string }): readonly string[] => {
  const position = request.from.indexOf(request.key);
  return position === -1 ? request.from : request.from.toSpliced(position, 1);
};

export const multisetRemainderOf = (request: { readonly from: readonly string[]; readonly taking: readonly string[] }): readonly string[] =>
  request.taking.reduce((remaining, key) => withoutOne({ from: remaining, key }), request.from).toSorted();
