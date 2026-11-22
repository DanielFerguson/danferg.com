import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliCompressSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const manifest = resolve(root, "crates/atc-sim/Cargo.toml");
const wasmOut = resolve(
  root,
  "crates/atc-sim/target/wasm32-unknown-unknown/release/atc_sim.wasm",
);
const publicDir = resolve(root, "public/wasm");
const publicWasm = resolve(publicDir, "atc_sim.wasm");

execFileSync(
  "cargo",
  ["build", "--manifest-path", manifest, "--release", "--target", "wasm32-unknown-unknown"],
  { stdio: "inherit" },
);

mkdirSync(publicDir, { recursive: true });
copyFileSync(wasmOut, publicWasm);

const bytes = readFileSync(publicWasm);
const brotli = brotliCompressSync(bytes);
console.log(
  `Built public/wasm/atc_sim.wasm: ${(bytes.byteLength / 1024).toFixed(1)} KB raw, ${(brotli.byteLength / 1024).toFixed(1)} KB Brotli`,
);
