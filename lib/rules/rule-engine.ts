import { NormalizedEvent } from "../events/normalized-event";
import { Rule, RuleCondition, RuleAction, RuleMatch, ConditionOperator } from "./types";

function getFieldValue(event: NormalizedEvent, field: string): any {
  const parts = field.split(".");
  let value: any = event;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

function evaluateCondition(event: NormalizedEvent, condition: RuleCondition): boolean {
  const value = getFieldValue(event, condition.field);

  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    case "notEquals":
      return value !== condition.value;
    case "contains":
      if (typeof value === "string") return value.toLowerCase().includes(String(condition.value).toLowerCase());
      if (Array.isArray(value)) return value.some(v => String(v).toLowerCase().includes(String(condition.value).toLowerCase()));
      return false;
    case "notContains":
      return !evaluateCondition(event, { ...condition, operator: "contains" });
    case "greaterThan":
      return Number(value) > Number(condition.value);
    case "lessThan":
      return Number(value) < Number(condition.value);
    case "in":
      if (Array.isArray(condition.value)) return condition.value.includes(value);
      return false;
    case "notIn":
      if (Array.isArray(condition.value)) return !condition.value.includes(value);
      return true;
    case "regex":
      if (typeof value === "string") return new RegExp(condition.value, "i").test(value);
      return false;
    case "exists":
      return value !== null && value !== undefined;
    case "notExists":
      return value === null || value === undefined;
    default:
      return false;
  }
}

function applyAction(event: NormalizedEvent, action: RuleAction): void {
  switch (action.type) {
    case "setPriority":
      event.priority = action.value;
      break;
    case "adjustScore":
      event.score = Math.max(0, Math.min(100, event.score + Number(action.value)));
      break;
    case "addTag":
      if (!event.labels.includes(action.value)) event.labels.push(action.value);
      break;
    case "markFollowUp":
      if (!event.labels.includes("follow-up")) event.labels.push("follow-up");
      break;
    case "markRisk":
      if (!event.labels.includes("risk")) event.labels.push("risk");
      if (event.score < 85) event.score = Math.min(100, event.score + 10);
      break;
    case "setExplanation":
      event.explanation = action.value;
      break;
  }
}

export function evaluateRule(event: NormalizedEvent, rule: Rule): RuleMatch | null {
  if (!rule.enabled) return null;

  const matchedConditions: string[] = [];
  let allMatched = rule.conditions.length === 0;

  for (const condition of rule.conditions) {
    const result = evaluateCondition(event, condition);
    if (result) {
      matchedConditions.push(condition.field);
      allMatched = true;
    }
  }

  if (!allMatched) return null;

  for (const action of rule.actions) {
    applyAction(event, action);
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    matchedConditions,
    actionsApplied: rule.actions,
  };
}

export function evaluateRules(event: NormalizedEvent, rules: Rule[]): RuleMatch[] {
  const matches: RuleMatch[] = [];

  const sortedRules = [...rules].filter(r => r.enabled).sort((a, b) => a.executionOrder - b.executionOrder);

  for (const rule of sortedRules) {
    const match = evaluateRule(event, rule);
    if (match) {
      matches.push(match);
      if (!event.rulesMatched) event.rulesMatched = [];
      event.rulesMatched.push(rule.id);
    }
  }

  return matches;
}
