export function pedidoHeaders(pathname: string): Record<string, string> | undefined {
  if (!pathname.startsWith("/pedido/")) return undefined;
  return {
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
}
