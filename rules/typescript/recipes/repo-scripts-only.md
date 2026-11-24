# Repo scripts only

```json
{
  "serves": [
    {
      "rule": "tools-live-in-the-repo"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"if this is common script it should be in package json, not run through tsx\"; \"I don't want a custom script, can you get something more standardised and provided by open source or something?\"",
    "standing": "accepted"
  }
}
```

- **Method:** Every tool is a dev dependency, run by a `package.json` script. Nothing runs through `npx`, `dlx` or a fetch at run time. A standard open-source tool wins over a custom script.
- **You can tell because:** Every command in CI and the docs is a script name.
- **Industry name:** Twelve-Factor, Dependencies.
