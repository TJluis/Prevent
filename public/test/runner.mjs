import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./opencode-loader.mjs", import.meta.url);
const test = process.argv[2];
await import(pathToFileURL(test).href);