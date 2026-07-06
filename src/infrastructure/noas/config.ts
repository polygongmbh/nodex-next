// The noas host used when a plain username (no @domain) signs in or
// registers. Overridable per deployment; the constant is the product's
// flagship server.
export const DEFAULT_NOAS_HOST =
  (import.meta.env.VITE_NOAS_HOST_URL as string | undefined)?.trim() || "nodex.nexus";
