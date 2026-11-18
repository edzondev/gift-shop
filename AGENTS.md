# gift-shop

Monorepo pnpm. Cada app es un Cloudflare Worker.

- `apps/api`: API HTTP en Hono. El front la llama por Service Binding con `hc<AppType>()`.
- `apps/web`: tienda pública y panel `/admin` en TanStack Start. Worker aparte.

## Comandos

Desde la raíz:

- `pnpm lint`
- `pnpm format`
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter api dev` levanta la API en local
- `pnpm --filter api cf-typegen` regenera `apps/api/worker-configuration.d.ts`
- `pnpm --filter web dev` levanta la tienda en local
- `pnpm --filter web cf-typegen` regenera `apps/web/worker-configuration.d.ts`

## Reglas

Las reglas de código viven en `biome.json`. No se duplican aquí.
