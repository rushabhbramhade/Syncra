import { NormalizedEvent, PriorityLevel } from "../events/normalized-event";

export type ConditionOperator = "equals" | "notEquals" | "contains" | "notContains" | "greaterThan" | "lessThan" | "in" | "notIn" | "regex" | "exists" | "notExists";

export type ActionType = "setPriority" | "adjustScore" | "addTag" | "setCategory" | "markFollowUp" | "markRisk" | "setExplanation";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface RuleAction {
  type: ActionType;
  value: any;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: "important" | "priority" | "followup" | "informational" | "risk";
  executionOrder: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  userOverridable: boolean;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  matchedConditions: string[];
  actionsApplied: RuleAction[];
}

export interface RuleEvaluationResult {
  event: NormalizedEvent;
  matches: RuleMatch[];
  finalPriority: PriorityLevel;
  finalScore: number;
}
