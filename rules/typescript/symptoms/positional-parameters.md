# Positional parameters

```json
{
  "group": "Unit shape",
  "seen": "A function of ours, whose shape no outside API fixes, that has two or more parameters.",
  "mayIndicate": [
    {
      "case": "names-something",
      "points": [
        {
          "rule": "one-word-everywhere"
        }
      ]
    },
    {
      "case": "does-one-job",
      "points": [
        {
          "rule": "handed-what-it-uses"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the signature",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "one-argument-object"
  ],
  "correctUses": [
    {
      "situation": "a callback whose signature an outside library fixes",
      "kind": "authorised-location",
      "at": "in the file that implements it"
    }
  ]
}
```

"Functions with no outside influence should take 1. 2 is debatable. But for agents the goal is always 1."
