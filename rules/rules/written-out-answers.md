# Written-out answers

```json
{
  "principle": "tests-are-ours",
  "standing": "accepted"
}
```

- **What must hold:** Every collaborator whose result the code under test uses is passed in; the test writes out each result it gives back, and checks what the code returns and every call it makes.
- **Source:** Meszaros calls this Literal Value: the test states its inputs and answers in place.

- **Review:** a test asserts the unit's output and its direct collaborator calls only
