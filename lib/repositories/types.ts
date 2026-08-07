import type { createAdminClient } from "@insforge/sdk";

/**
 * Type alias for the InsForge admin database client.
 * Using ReturnType preserves full query builder chain types.
 */
export type AdminDb = ReturnType<typeof createAdminClient>;
