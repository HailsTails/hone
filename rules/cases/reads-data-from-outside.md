# Reads data from outside (request, file, environment, stored row, response)

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "no-leak-across-a-boundary"
    },
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "principle": "the-type-checker-proves-it"
    },
    {
      "rule": "one-reason-per-module"
    }
  ]
}
```

The reader for whoever produced it parses it once, at the boundary, into a type of our own. A required value that is missing is a failure, never a default. A test never sets the environment. Past the reader, units and their tests use objects, never text.
