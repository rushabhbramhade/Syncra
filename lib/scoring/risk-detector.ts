import { NormalizedEvent } from "../events/normalized-event";

export interface RiskEvent {
  event: NormalizedEvent;
  riskType: "missed_deadline" | "customer_escalation" | "build_failure" | "security_alert" | "calendar_conflict" | "overdue_invoice";
  severity: "critical" | "high" | "medium";
  description: string;
  recommendedAction: string;
}

export function detectRisks(events: NormalizedEvent[]): RiskEvent[] {
  const risks: RiskEvent[] = [];

  for (const event of events) {
    if (event.labels?.includes("risk") && event.priority === "critical") {
      const isSecurity = detectSecurityAlert(event);
      const isBuild = detectBuildFailure(event);
      const isEscalation = detectCustomerEscalation(event);

      if (isSecurity) {
        risks.push({
          event,
          riskType: "security_alert",
          severity: "critical",
          description: `Security alert: ${event.title}`,
          recommendedAction: "Investigate immediately and follow security protocols",
        });
      }
      if (isBuild) {
        risks.push({
          event,
          riskType: "build_failure",
          severity: "critical",
          description: `Build/deployment failure: ${event.title}`,
          recommendedAction: "Check build logs and rollback if necessary",
        });
      }
      if (isEscalation) {
        risks.push({
          event,
          riskType: "customer_escalation",
          severity: "high",
          description: `Customer escalation from ${event.sender.name}: ${event.title}`,
          recommendedAction: "Respond within 1 hour with status update",
        });
      }
    }

    if (event.category === "meeting" || event.category === "task") {
      const conflict = detectCalendarConflict(event, events);
      if (conflict) risks.push(conflict);
    }
  }

  return risks;
}

function detectSecurityAlert(event: NormalizedEvent): boolean {
  const keywords = /security|breach|unauthorized|suspicious|login|password|2fa|mfa|vulnerability|exploit/i;
  return keywords.test(event.title) || keywords.test(event.summary);
}

function detectBuildFailure(event: NormalizedEvent): boolean {
  const keywords = /fail|error|crash|down|outage|degred|rollback|incident|503|500/i;
  return keywords.test(event.title) || keywords.test(event.summary);
}

function detectCustomerEscalation(event: NormalizedEvent): boolean {
  const urgent = /urgent|escalat|critical|asap|blocker|emergency|overdue/i;
  return (event.sender.isClient || false) && (urgent.test(event.title) || urgent.test(event.summary));
}

function detectCalendarConflict(event: NormalizedEvent, allEvents: NormalizedEvent[]): RiskEvent | null {
  if (event.platform !== "calendar" || !event.metadata.calendar) return null;
  const startA = new Date(event.metadata.calendar.startTime).getTime();
  const endA = new Date(event.metadata.calendar.endTime).getTime();
  if (!startA || !endA) return null;

  for (const other of allEvents) {
    if (other.id === event.id || other.platform !== "calendar" || !other.metadata.calendar) continue;
    const startB = new Date(other.metadata.calendar.startTime).getTime();
    const endB = new Date(other.metadata.calendar.endTime).getTime();
    if (!startB || !endB) continue;

    if (startA < endB && startB < endA) {
      return {
        event,
        riskType: "calendar_conflict",
        severity: "medium",
        description: `Calendar conflict: "${event.title}" overlaps with "${other.title}"`,
        recommendedAction: "Reschedule one of the meetings or notify attendees",
      };
    }
  }
  return null;
}
