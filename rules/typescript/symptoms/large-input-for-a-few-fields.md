# Large input for a few fields

```json
{
  "group": "Tests",
  "seen": "A test that writes a large object, or casts, to give the unit the few fields it reads.",
  "mayIndicate": [
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "handed-what-it-uses"
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
  "breachUsuallySits": "in the unit's declared input",
  "seenBy": [
    "person",
    "syntax"
  ],
  "recipes": [
    "one-argument-object"
  ],
  "correctUses": [],
  "howItIsSeen": "syntax for the cast.",
  "toNameTheBreach": "types: the parameter's declaration and the fields read."
}
```
