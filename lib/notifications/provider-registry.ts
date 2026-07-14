import { NotificationProvider } from "./provider";
import { providerLogger } from "./logger";

class NotificationProviderRegistry {
  private providers = new Map<string, NotificationProvider>();

  register(provider: NotificationProvider): void {
    if (this.providers.has(provider.id)) {
      providerLogger.warn({ providerId: provider.id }, "Provider already registered, overwriting");
    }
    this.providers.set(provider.id, provider);
    providerLogger.info({ providerId: provider.id }, "Provider registered");
  }

  get(id: string): NotificationProvider | null {
    return this.providers.get(id) || null;
  }

  list(): NotificationProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableIds(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const notificationProviderRegistry = new NotificationProviderRegistry();