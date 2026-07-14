import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_vbvoquqyjusiocietvan",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  tsconfig: "./tsconfig.json",
  additionalPackages: ["@insforge/sdk", "@insforge/sdk/ssr"],
  deploy: {
    env: {
      NEXT_PUBLIC_INSFORGE_BASE_URL: "${NEXT_PUBLIC_INSFORGE_BASE_URL}",
      INSFORGE_API_KEY: "${INSFORGE_API_KEY}",
      TELEGRAM_BOT_KEY: "${TELEGRAM_BOT_KEY}",
      OPENROUTER_API_KEY: "${OPENROUTER_API_KEY}",
      OPENROUTER_MODEL: "${OPENROUTER_MODEL}",
    },
  },
});