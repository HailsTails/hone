# Change spread across modules

```json
{
  "seen": "One change for one reason touches many modules, or two modules always change together.",
  "mayIndicate": [
    {
      "case": "puts-code-in-a-file-or-folder",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the module boundaries",
  "recipes": [
    "screaming-folders"
  ],
  "correctUses": []
}
```
