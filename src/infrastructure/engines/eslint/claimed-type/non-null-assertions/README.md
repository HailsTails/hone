# CD-2 ESLint piece

This piece enforces CD-2's `non-null-assertions` clause through ESLint. It is one rule, `no-restricted-syntax`, in the plugin `cd2/cd2.eslint-plugin.ts` under the namespace `hone-cd2`. It reuses ESLint's `no-restricted-syntax` with two selectors carried as `options` in `piece.json`:

- `TSNonNullExpression` flags every non-null assertion, `x!`, the same node typescript-eslint's `no-non-null-assertion` reports.
- `[definite=true]` flags every definite assignment assertion, `let x!: T` and `field!: T`, which no typescript-eslint rule reports.

One rule carries both forms, so the clause has one rule id.

## Adopting the rule

The projection is the only supported way to adopt the rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
