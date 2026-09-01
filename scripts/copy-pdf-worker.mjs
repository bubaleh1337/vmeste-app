import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const target = resolve(root, "public/pdf.worker.min.mjs");
await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log("PDF.js worker prepared.");
