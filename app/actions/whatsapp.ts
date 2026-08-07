"use server";

import { WhatsAppClientManager } from "@/lib/whatsapp/client";
import { disconnectConnection } from "@/lib/integrations/actions-core";
import { requireOwnership } from "@/lib/auth-guard";

// E.164 regex: + followed by 1-15 digits
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Validates E.164 phone number format.
 */
function validatePhone(phone: string): boolean {
  return E164_REGEX.test(phone);
}

/**
 * Request a pairing code for WhatsApp Web link.
 * Returns the pairing code + expiry timestamp.
 */
export async function requestWhatsAppPairingAction(userId: string, phone: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    
    if (!validatePhone(phone)) {
      return { success: false, error: "Invalid phone number format. Use E.164 format (e.g., +919876543210)." };
    }
    
    const { code, expiresAt } = await WhatsAppClientManager.requestPairingCode(userId, phone);
    return { success: true, code, expiresAt, status: "pending" as const };
  } catch (error: unknown) {
    console.error("requestWhatsAppPairingAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to generate pairing code.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Returns the current pairing code + status for an in-progress pairing.
 * If code is expired, returns null so frontend can request refresh.
 */
export async function getWhatsAppPairingStatusAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    
    const state = WhatsAppClientManager.getPairingCode(userId);
    if (!state) return { success: true, status: "none" as const };
    if (state.connected) return { success: true, status: "connected" as const };
    
    // Check if code is expired
    if (state.expiresAt < Date.now()) {
      return { success: true, status: "expired" as const };
    }
    
    return { 
      success: true, 
      status: "pending" as const, 
      code: state.code, 
      expiresAt: state.expiresAt 
    };
  } catch (error: unknown) {
    console.error("getWhatsAppPairingStatusAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to fetch pairing status.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Generate a new pairing code (code expired or user clicked refresh).
 */
export async function refreshWhatsAppPairingAction(userId: string, phone: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    
    const { code, expiresAt } = await WhatsAppClientManager.refreshPairingCode(userId, phone);
    return { success: true, code, expiresAt, status: "pending" as const };
  } catch (error: unknown) {
    console.error("refreshWhatsAppPairingAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to refresh pairing code.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Cancel an unused pairing session (modal closed / user cancelled).
 */
export async function cancelWhatsAppPairingAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    
    await WhatsAppClientManager.cancelPairing(userId);
    return { success: true };
  } catch (error: unknown) {
    console.error("cancelWhatsAppPairingAction failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to cancel pairing." };
  }
}

/**
 * Starts a QR-based Baileys pairing session and returns the first QR payload.
 */
export async function startWhatsAppQRAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const { qr, expiresAt } = await WhatsAppClientManager.startPairingQR(userId);
    return { success: true, qr, expiresAt, status: "pending" as const };
  } catch (error: unknown) {
    console.error("startWhatsAppQRAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to start WhatsApp pairing.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Returns the latest QR for an in-progress pairing plus link status.
 */
export async function getWhatsAppQRAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const state = WhatsAppClientManager.getPairingQR(userId);
    if (!state) return { success: true, status: "none" as const };
    if (state.connected) return { success: true, status: "connected" as const };
    if (state.qr) return { success: true, status: "pending" as const, qr: state.qr, expiresAt: state.expiresAt };
    return { success: true, status: "pending" as const };
  } catch (error: unknown) {
    console.error("getWhatsAppQRAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to fetch WhatsApp QR.";
    return { success: false, error: errorMsg };
  }
}

/**
 * NON-destructive QR renewal — keeps the pairing session + auth state + DB
 * session alive and only regenerates the socket + QR. No re-link required.
 */
export async function refreshWhatsAppQRAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const { qr, expiresAt } = await WhatsAppClientManager.refreshPairingQR(userId);
    return { success: true, qr, expiresAt, status: "pending" as const };
  } catch (error: unknown) {
    console.error("refreshWhatsAppQRAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to refresh WhatsApp QR.";
    return { success: false, error: errorMsg };
  }
}

/**
 * Destroys an unused pairing session when the user cancels / closes the modal.
 */
export async function cancelWhatsAppQRAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    await WhatsAppClientManager.cancelPairing(userId);
    return { success: true };
  } catch (error: unknown) {
    console.error("cancelWhatsAppQRAction failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to cancel WhatsApp pairing." };
  }
}

/**
 * Disconnect WhatsApp and clean up session.
 */
export async function disconnectWhatsAppAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    
    await WhatsAppClientManager.disconnect(userId);
    await disconnectConnection(userId, "whatsapp");
    return { success: true };
  } catch (error: unknown) {
    console.error("disconnectWhatsAppAction failed:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to disconnect WhatsApp.";
    return { success: false, error: errorMsg };
  }
}
