# Puts code in a file or folder

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "one-place-decides"
    },
    {
      "principle": "our-code-reads-in-the-common-language"
    },
    {
      "rule": "one-reason-per-module"
    }
  ]
}
```

A module holds what changes for one reason, named for that domain concept. A domain type lives with its logic; a file of types alone holds only port declarations. A drawer of unrelated pieces, test helpers included, has no home.
