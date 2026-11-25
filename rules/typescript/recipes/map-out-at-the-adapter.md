# Map out at the adapter

```json
{
  "serves": [
    {
      "principle": "no-leak-across-a-boundary"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"As we should be runtime objects not json as soon as we leave a boundary\".",
    "standing": "accepted"
  },
  "examples": [
    {
      "anchor": "serialising-or-parsing-json",
      "answers": [
        {
          "check": "text-past-its-reader#test-body",
          "form": "serialising-or-parsing-json"
        }
      ]
    }
  ]
}
```

- **Method:** Business logic hands the adapter our own value. Only the adapter turns it into the receiver's form (`JSON.stringify`, a status, a header).
- **You can tell because:** No outside form is built in business logic.
- **Industry name:** anticorruption layer (Evans).

## Examples

### Serialising or parsing JSON
```ts
declare const publish: (request: { readonly id: string; readonly send: (text: string) => void }) => void;
const send = vi.fn<(text: string) => void>();
publish({ id: "a", send });
expect(send).toHaveBeenCalledWith(JSON.stringify({ id: "a" }));
```

Hand the adapter our own value, and leave the text to it:

```ts
declare const publish: (request: { readonly id: string; readonly send: (task: { readonly id: string }) => void }) => void;
const send = vi.fn<(task: { readonly id: string }) => void>();
publish({ id: "a", send });
expect(send).toHaveBeenCalledWith({ id: "a" });
```
