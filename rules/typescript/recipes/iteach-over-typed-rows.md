# it.each over typed rows

```json
{
  "serves": {
    "rule": "straight-through-tests"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"It's just boilerplate for cases being tested.\"",
    "standing": "accepted"
  }
}
```

- **Method:** Several cases of one behaviour are one `it.each<Row>([...])`. `Row` is a declared type. Each row writes out its input and its expected output.
- **You can tell because:** Every row is a literal. No row is built, mapped or picked.
- **Industry name:** Parameterized Test (Meszaros), with rows typed and written out.
