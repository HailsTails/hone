import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: import.meta.dirname });
const results = await eslint.lintFiles(["src"]);
const lines = results.flatMap((result) =>
  result.messages.map(
    (message) => `${result.filePath.slice(import.meta.dirname.length + 1).replaceAll("\\", "/")}:${message.line}:${message.column} ${message.ruleId}`,
  ),
);
process.stdout.write(lines.map((line) => `${line}\n`).join(""));
process.exitCode = lines.length === 0 ? 0 : 1;