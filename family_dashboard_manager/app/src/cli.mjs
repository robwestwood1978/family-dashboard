import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compileDashboard } from "./compile-dashboard.mjs";

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error("Usage: node src/cli.mjs <config.json> <dashboard.yaml>");
  process.exitCode = 2;
} else {
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  const config = JSON.parse(await readFile(inputPath, "utf8"));
  const yaml = compileDashboard(config);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, yaml, "utf8");
  console.log(`Compiled ${inputPath} -> ${outputPath}`);
}
