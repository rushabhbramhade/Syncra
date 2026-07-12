"use server";

import { WhatsAppClientManager } from "@/lib/whatsapp/client";
import { getConnectionStatus, disconnectConnection } from "./integrations";

/**
 * Initiates the Baileys socket connection and requests a pairing code for the phone number.
 */
export async function requestWhatsAppPairingCodeAction(userId: string, phoneNumber: string) {
  try {
    const code = await WhatsAppClientManager.requestPairingCode(userId, phoneNumber);
    return { success: true, pairingCode: code };
  } catch (error: unknown) {
    console.error("requestWhatsAppPairingCodeAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to generate pairing code.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Returns connection status, ensuring the client socket is initialized if session creds exist.
 */
export async function getWhatsAppStatusAction(userId: string) {
  try {
    const hasSession = WhatsAppClientManager.isSessionSaved(userId);
    if (hasSession) {
      // In the background, make sure the connection is initialized and active
      WhatsAppClientManager.getClient(userId).catch(err => {
        console.error("Failed to start WhatsApp client on check status:", err);
      });
    }

    const status = await getConnectionStatus(userId, "whatsapp");
    if (status) {
      return { success: true, status };
    }

    return {
      success: true,
      status: hasSession ? {
        connected: false,
        email: "whatsapp_linked_device",
        connectedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        provider: "whatsapp",
        status: "pairing",
      } : null
    };
  } catch (error: unknown) {
    console.error("getWhatsAppStatusAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to check WhatsApp status.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Logs out and cleans up session storage/credentials for WhatsApp.
 */
export async function disconnectWhatsAppAction(userId: string) {
  try {
    await WhatsAppClientManager.disconnect(userId);
    await disconnectConnection(userId, "whatsapp");
    return { success: true };
  } catch (error: unknown) {
    console.error("disconnectWhatsAppAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to disconnect WhatsApp.";
    return { success: false, error: errorMsg };
  }
}
