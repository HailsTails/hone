# directive-pointers

```json
{}
```

TODOs, linter directives and `@ts-expect-error` without a tracker.

- **Settings traced to:** reference form "need a digit": **nothing**.

## Flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `// TODO` not followed, after optional spaces, by a tracked reference, for example `// TODO(#42) ...`.
- A comment starting with `biome-ignore`, `eslint-disable`, `eslint-enable`, `eslint-disable-line`, `eslint-disable-next-line`, an `oxlint-` equivalent or `eslint <config>`, unless the comment carries a tracked reference.
- A TypeScript directive without a tracked reference after it, in each form the compiler honours: `@ts-expect-error` or `@ts-ignore` opening a `//` or `///` comment, or opening the last line of a block comment after any `/` and `*`; and `@ts-nocheck`, in any letter case, opening a `//` or `///` comment among the comments that start the file. As in the compiler, `@ts-ignore` and `@ts-expect-error` are matched as written, so `@ts-ignored` counts and `@Ts-Ignore` does not. Forms the compiler ignores, such as `/* @ts-nocheck */`, a directive above a block comment's closing line, or `////`, are not flagged. `@ts-check` turns checking on and is not flagged.
- A tracked reference is a parenthesised token with no spaces that contains a digit, such as `(#42)`, `(PROJ-7)`, `(spec-42)` or `(https://tracker.example/issues/42)`. `()`, `(legacy)` and `(issue 42)` are not tracked references.
- TODO is matched on raw lines, so the same text inside a string is flagged too; linter and type directives are read from comments only.
- Ordinary explanatory comments and JSDoc are not flagged; keeping them out is left to review.

## Settings
`trackerPatterns` narrows which tracked references count, for example to your own tracker's format. Each entry is a regular expression, as JavaScript source text, tested against each tracked reference with its parentheses; a reference counts when any entry matches. The test is an unanchored search unless the pattern anchors itself with `^` and `$`. The default, `["^\\(\\S+\\)$"]`, lets every tracked reference count.

```jsonc
"clauseSettings": {
  "CD-5#comments-directives": { "trackerPatterns": ["^\\(spec-\\d+\\)$", "^\\(#\\d+\\)$"] }
}
```

The patterns only narrow: a reference must still be a parenthesised token with no spaces that contains a digit, so a pattern such as `.*` cannot make `(legacy)` count. The same measure applies to TODO, where the reference must come right after `TODO`. Each entry must be a non-empty string that compiles as a regular expression; otherwise the check stops with a piece-invalid failure naming the clause and the entry.

## Example
```ts
// biome-ignore lint/style/noNonNullAssertion: legacy
const first = items[0]!;
```

## Fix
```ts
const first = items[0];
```
Remove the need for the directive. If it must stay, add a tracked reference to the work that removes it: `// biome-ignore lint/style/noNonNullAssertion: until items is typed as non-empty (#42)`. The reference satisfies this clause only. A directive that escapes a selected clause, such as an `eslint-disable` naming a selected rule or a `@ts-expect-error` under [unlisted-cast-site](../claimed-type/unlisted-cast-site.md), still needs a file record on that clause, and that record does not satisfy this clause.
