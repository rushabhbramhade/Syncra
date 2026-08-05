/**
 * Capability system — the AI's routing table.
 *
 * The AI asks "which connected provider supports this capability?" instead of
 * checking provider names. This module answers that question against the
 * capability catalog (constants) and the live provider registry.
 *
 * Pure module: no provider imports, no side effects. Capability resolution is
 * injected via the registry getter to avoid circular imports.
 */

import { CAPABILITY_CATALOG, CapabilityId, ProviderId, isCapabilityId } from "./constants";

export type ProviderGetter = (providerId: ProviderId) => unknown;

export class CapabilityRegistry {
  constructor(private readonly getProvider: ProviderGetter) {}

  /** All capability ids a provider declares in the catalog. */
  capabilitiesFor(providerId: ProviderId): CapabilityId[] {
    return (Object.entries(CAPABILITY_CATALOG) as [CapabilityId, readonly ProviderId[]][])
      .filter(([, providers]) => providers.includes(providerId))
      .map(([capability]) => capability);
  }

  /** Providers that declare a capability AND are registered in the live registry. */
  resolve(capability: CapabilityId): ProviderId[] {
    const declared = providersFor(capability);
    return declared.filter((providerId) => this.getProvider(providerId) != null);
  }

  /** Is this integration capable of the requested capability? */
  can(capability: CapabilityId, providerId: ProviderId): boolean {
    return providersFor(capability).includes(providerId);
  }

  /** Validate a capability id; returns null when unknown. */
  parse(value: string): CapabilityId | null {
    return isCapabilityId(value) ? value : null;
  }
}

/** Default registry wired to the global provider registry. */
import { IntegrationRegistry } from "./provider-base";

export const capabilityRegistry = new CapabilityRegistry((providerId) =>
  IntegrationRegistry.get(providerId)
);

/** Narrow the catalog to a plain readonly provider array (avoids union-tuple collapse). */
function providersFor(capability: CapabilityId): readonly ProviderId[] {
  return CAPABILITY_CATALOG[capability] as readonly ProviderId[];
}
