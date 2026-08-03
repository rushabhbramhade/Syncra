import { z } from "zod";
import { PROVIDER_IDS } from "@/features/integrations/types";

export const providerIdSchema = z.enum(PROVIDER_IDS);

export const userIdSchema = z.string().uuid("Invalid user id.");

export const integrationSettingsSchema = z.object({
  auto_sync: z.boolean().optional(),
  notifications: z.boolean().optional(),
  background_sync: z.boolean().optional(),
  token_refresh: z.boolean().optional(),
});

export const connectIntegrationSchema = z.object({
  userId: userIdSchema,
  providerId: providerIdSchema,
});

export const disconnectIntegrationSchema = connectIntegrationSchema;

export const reconnectIntegrationSchema = connectIntegrationSchema;

export const syncIntegrationSchema = connectIntegrationSchema;

export const deleteIntegrationSchema = connectIntegrationSchema;

export const refreshTokenSchema = connectIntegrationSchema;

export const getIntegrationSchema = connectIntegrationSchema;

export const getIntegrationLogsSchema = connectIntegrationSchema.extend({
  limit: z.number().int().min(1).max(50).optional(),
});

export const updateSettingsSchema = z.object({
  userId: userIdSchema,
  providerId: providerIdSchema,
  settings: integrationSettingsSchema,
});
