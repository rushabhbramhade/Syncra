import { NormalizedEvent } from "@/lib/events/normalized-event";
import { Rule } from "@/lib/rules/types";
import { UserPreferences } from "./preference-engine";

export function personalizeEvent(event: NormalizedEvent, preferences: UserPreferences): NormalizedEvent {
  let scoreAdjustment = 0;

  if (preferences.lowPrioritySenders.some(s => event.sender?.email?.includes(s) || event.sender?.name?.includes(s))) {
    scoreAdjustment -= 15;
  }

  if (preferences.vipSenders.some(s => event.sender?.email?.includes(s) || event.sender?.name?.includes(s))) {
    scoreAdjustment += 15;
  }

  if (preferences.preferredPlatforms.includes(event.platform)) {
    scoreAdjustment += 5;
  }

  if (preferences.ignoredCategories.includes(event.category)) {
    scoreAdjustment -= 20;
  }

  const adjusted = event.score + scoreAdjustment;
  return {
    ...event,
    score: Math.max(0, Math.min(100, adjusted)),
  };
}

export function getPersonalizedRules(userId: string, baseRules: Rule[], preferences: UserPreferences): Rule[] {
  return baseRules.map(rule => {
    if (preferences.ignoredCategories.length > 0 && rule.category === "informational") {
      return { ...rule, enabled: false };
    }
    return rule;
  });
}
