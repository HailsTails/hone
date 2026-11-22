# import-or-require

```json
{}
```

- **Misses:** `import()`, `require`, globals.
- **Settings traced to:** `confinedPackages`, empty by default on purpose: the universe of outside dependencies cannot be listed, and flagging every import would catch internal packages. Telling outside from internal needs the workspace layout, which Hone can read.
