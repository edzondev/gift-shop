# gift-shop

Monorepo pnpm. Cada app es un Cloudflare Worker.

- `apps/api`: API HTTP en Hono. El front la llama por Service Binding con `hc<AppType>()`.
- `apps/web`: otro PR. No está en este repo todavía.

## Comandos

Desde la raíz:

- `pnpm lint`
- `pnpm format`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter api dev` levanta la API en local
- `pnpm --filter api cf-typegen` regenera `apps/api/worker-configuration.d.ts`

## Reglas

Las reglas de código viven en `biome.json`. No se duplican aquí.
