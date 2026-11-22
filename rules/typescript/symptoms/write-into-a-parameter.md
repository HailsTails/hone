# Write into a parameter

```json
{
  "group": "Effects and state",
  "seen": "Assigning to or deleting a parameter's field, or calling an in-place method (`push`, `sort`, `splice`) on a parameter.",
  "mayIndicate": [
    {
      "case": "makes-a-new-value-from-what-it-has",
      "points": [
        {
          "principle": "no-hidden-effects"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit",
  "seenBy": [
    "syntax",
    "types"
  ],
  "reports": "seen",
  "recipes": [
    "copy-never-write-in"
  ],
  "correctUses": [],
  "howItIsSeen": "types for in-place methods."
}
```
