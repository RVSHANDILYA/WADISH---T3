import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Compile the actual local JSON as a literal against the app's exported contract.
// This catches missing/extra fields and wrong nested types without duplicating a schema.
const root = new URL("../", import.meta.url);
const data = JSON.parse(readFileSync(new URL("public/data/summary.json", root), "utf8"));
const output = new URL("test-results/summary-contract.ts", root);
mkdirSync(new URL("test-results/", root), { recursive: true });
writeFileSync(output, 'import type { Summary } from "../src/types";\nconst summary = ' + JSON.stringify(data) + ' satisfies Summary;\n');
const configPath = new URL("test-results/summary-tsconfig.json", root);
writeFileSync(configPath, JSON.stringify({
  extends: "../tsconfig.json", compilerOptions: { incremental: false },
  include: ["summary-contract.ts"],
}));
// Use the stable CLI, which supports both TypeScript 6 and the native TS 7 compiler.
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("node_modules/typescript/bin/tsc", root)),
  "--project", fileURLToPath(configPath), "--pretty", "false",
], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
else {
  console.log("Generated summary matches src/types.ts, including every model and simulation field.");
}
