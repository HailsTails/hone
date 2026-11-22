# One word everywhere

```json
{
  "principle": "our-code-reads-in-the-common-language",
  "standing": "accepted",
  "lenses": [
    "function-first",
    "naming"
  ]
}
```

- **What must hold:** Every value, unit, field and module is named with the domain's one word for what it is, spelt the same everywhere and at every scope; no meaning rests on position, and our code carries no prose, not even prose that repeats the code.
- **Source:** Evans's ubiquitous language, across the whole codebase.

One word everywhere keeps "no meaning rests on position". A unit whose signature is ours takes one argument; a callback shaped by an outside API takes what that API passes.

Casing is a check under this rule. Writing basic logic in the language's own constructs is a case; the principle gives it.
