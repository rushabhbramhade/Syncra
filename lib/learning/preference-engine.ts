export interface UserPreferences {
  vipSenders: string[];
  lowPrioritySenders: string[];
  preferredPlatforms: string[];
  ignoredCategories: string[];
  workingHours: { start: number; end: number };
  focusModeEnabled: boolean;
}

const defaultPreferences: UserPreferences = {
  vipSenders: [],
  lowPrioritySenders: [],
  preferredPlatforms: [],
  ignoredCategories: [],
  workingHours: { start: 9, end: 17 },
  focusModeEnabled: false,
};

const store = new Map<string, UserPreferences>();

export function getUserPreferences(userId: string): UserPreferences {
  return store.get(userId) ?? { ...defaultPreferences };
}

export function updateFromFeedback(userId: string, signal: { action: string; sender?: string; category?: string; platform?: string }): void {
  const prefs = getUserPreferences(userId);
  if (signal.action === "mark_critical" && signal.sender) {
    if (!prefs.vipSenders.includes(signal.sender)) {
      prefs.vipSenders.push(signal.sender);
    }
  }
  if (signal.action === "mark_not_important" && signal.sender) {
    if (!prefs.lowPrioritySenders.includes(signal.sender)) {
      prefs.lowPrioritySenders.push(signal.sender);
    }
  }
  if (signal.action === "open" && signal.platform && !prefs.preferredPlatforms.includes(signal.platform)) {
    prefs.preferredPlatforms.push(signal.platform);
  }
  if (signal.action === "dismiss" && signal.category && !prefs.ignoredCategories.includes(signal.category)) {
    prefs.ignoredCategories.push(signal.category);
  }
  store.set(userId, prefs);
}
