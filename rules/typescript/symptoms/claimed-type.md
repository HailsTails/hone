# Claimed type

```json
{
  "group": "Claimed or loose types",
  "seen": "`as T` other than `as const`, `<T>x`, `x!` or `x!:`, including `as unknown` and any cast whose type holds `any`.",
  "mayIndicate": [
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "declared-not-asserted"
        }
      ]
    },
    {
      "case": "checks-a-value-that-may-be-one-of-several-outcomes",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    },
    {
      "case": "gives-a-value-its-type",
      "situation": "in a test, a cast to build an input",
      "points": [
        {
          "rule": "handed-what-it-uses"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the declaration: an input too wide, a generic not bounded, a missing parse",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "fix-the-declaration-not-the-value",
    "assert-to-narrow",
    "one-argument-object"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "authorised-location",
      "at": "in the adapter whose outside contract forces it"
    }
  ],
  "breachACheckCouldName": "the declaration, by types.",
  "toNameTheBreach": "types."
}
```

"this feels like its hiding a problem with out modelling"
