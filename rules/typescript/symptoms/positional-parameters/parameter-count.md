# parameter-count

```json
{
  "engines": [
    "eslint"
  ]
}
```

- **Misses:** our own functions with exactly two parameters.
- **Settings traced to:** `max: 2`: a recorded compromise of the check, which cannot tell the two kinds apart. "Positional parameters is 2 because it flags functions designed to be used in native APIs even inline unnamed ones for things like map/reduce. Making 1 untenable."; "The check is not right. Its unable to distinguish.".
