import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import nextEnv from "@next/env";

const root = process.cwd();
const { loadEnvConfig } = nextEnv;

loadEnvConfig(root);

const routeDirs = ["app", "pages", "src/app", "src/pages"];
const existingRouteDirs = routeDirs.filter((dir) => {
  const path = join(root, dir);
  return existsSync(path) && statSync(path).isDirectory();
});

const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (existingRouteDirs.length > 0 && missingEnvVars.length === 0) {
  console.log(`[verify-next-root] Next route directory found: ${existingRouteDirs.join(", ")}`);
  console.log("[verify-next-root] Required build environment variables are present.");
  process.exit(0);
}

const entries = readdirSync(root, { withFileTypes: true })
  .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
  .sort()
  .join(", ");

if (existingRouteDirs.length === 0) {
  console.error("[verify-next-root] Next route directory missing.");
  console.error(`[verify-next-root] Build root: ${root}`);
  console.error(`[verify-next-root] Expected one of: ${routeDirs.join(", ")}`);
  console.error(`[verify-next-root] Root entries: ${entries}`);
  console.error(
    "[verify-next-root] In Vercel, check that the Root Directory points at this app and that the app/ directory is committed."
  );
}

if (missingEnvVars.length > 0) {
  console.error("[verify-next-root] Missing required Supabase environment variables:");
  for (const name of missingEnvVars) {
    console.error(`[verify-next-root] - ${name}`);
  }
  console.error(
    "[verify-next-root] Add them in Vercel Project Settings -> Environment Variables for every deployment environment you use, then redeploy."
  );
  console.error(
    "[verify-next-root] NEXT_PUBLIC_* values are embedded during next build, so they must exist before the build starts."
  );
}

process.exit(1);
