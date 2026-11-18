/// <reference path="../node_modules/@cloudflare/vitest-plugin/types/cloudflare-test.d.ts" />
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
      TEST_ROLLBACK: import("cloudflare:test").D1Migration[];
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
