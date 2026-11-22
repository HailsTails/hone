# Edit inside vendored code

```json
{
  "seen": "A change to a file inside a vendored folder.",
  "mayIndicate": [
    {
      "case": "takes-an-outside-dependency",
      "points": [
        {
          "rule": "upstream-stays-untouched"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the change",
  "recipes": [
    "extension-outside-the-vendored-code"
  ],
  "correctUses": [
    {
      "situation": "drift, an edit impossible to apply as an extension",
      "kind": "authorised-location",
      "at": "stating when to drop it"
    }
  ]
}
```
