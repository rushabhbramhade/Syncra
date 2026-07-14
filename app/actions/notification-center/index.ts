"use server";

import { createAdminDb } from "@/lib/db";
import { requireOwnership } from "@/lib/auth-guard";
import { NotificationCenterRepository } from "@/lib/repositories/notification-center-repository";
import { NotificationHistoryRepository } from "@/lib/repositories/notification-history-repository";

function getCenterRepo(): NotificationCenterRepository {
  return new NotificationCenterRepository(createAdminDb());
}

function getHistoryRepo(): NotificationHistoryRepository {
  return new NotificationHistoryRepository(createAdminDb());
}

export async function getNotificationsAction(
  userId: string,
  options?: { limit?: number; offset?: number; status?: "unread" | "read" | "archived"; type?: string }
) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getCenterRepo();
    const notifications = await repo.findByUserId(guard.userId, options);
    const unreadCount = await repo.getUnreadCount(guard.userId);
    return { success: true, notifications, unreadCount };
  } catch (error) {
    console.error("getNotificationsAction failed:", error);
    return { success: false, error: "Failed to load notifications." };
  }
}

export async function getUnreadCountAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error, count: 0 };
  try {
    const repo = getCenterRepo();
    const count = await repo.getUnreadCount(guard.userId);
    return { success: true, count };
  } catch (error) {
    console.error("getUnreadCountAction failed:", error);
    return { success: false, error: "Failed to get unread count.", count: 0 };
  }
}

export async function markAsReadAction(userId: string, ids: string[]) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getCenterRepo();
    await repo.markAsRead(guard.userId, ids);
    return { success: true };
  } catch (error) {
    console.error("markAsReadAction failed:", error);
    return { success: false, error: "Failed to mark as read." };
  }
}

export async function markAsArchivedAction(userId: string, ids: string[]) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getCenterRepo();
    await repo.markAsArchived(guard.userId, ids);
    return { success: true };
  } catch (error) {
    console.error("markAsArchivedAction failed:", error);
    return { success: false, error: "Failed to archive." };
  }
}

export async function deleteNotificationsAction(userId: string, ids: string[]) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getCenterRepo();
    await repo.delete(guard.userId, ids);
    return { success: true };
  } catch (error) {
    console.error("deleteNotificationsAction failed:", error);
    return { success: false, error: "Failed to delete." };
  }
}

export async function searchNotificationsAction(userId: string, query: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error, results: [] };
  try {
    const repo = getCenterRepo();
    const results = await repo.search(guard.userId, query);
    return { success: true, results };
  } catch (error) {
    console.error("searchNotificationsAction failed:", error);
    return { success: false, error: "Failed to search.", results: [] };
  }
}

export async function getNotificationStatsAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error, stats: { total: 0, sent: 0, failed: 0, delivered: 0 } };
  try {
    const historyRepo = getHistoryRepo();
    const stats = await historyRepo.getStats(guard.userId);
    return { success: true, stats };
  } catch (error) {
    console.error("getNotificationStatsAction failed:", error);
    return { success: false, error: "Failed to get stats.", stats: { total: 0, sent: 0, failed: 0, delivered: 0 } };
  }
}