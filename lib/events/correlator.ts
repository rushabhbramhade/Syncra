import { NormalizedEvent, EventCluster } from "./normalized-event";

function extractPRNumber(text: string): number | null {
  const match = text.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function extractRepoName(text: string): string | null {
  const match = text.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function correlateEvents(events: NormalizedEvent[]): { clusters: EventCluster[]; crossRefs: Map<string, string[]> } {
  const clusters: EventCluster[] = [];
  const crossRefs = new Map<string, string[]>();
  let clusterId = 0;

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      const rel = findCorrelation(a, b);
      if (rel) {
        const cluster: EventCluster = {
          id: `cluster-${clusterId++}`,
          primaryEventId: a.score >= b.score ? a.id : b.id,
          relatedEventIds: [a.id, b.id],
          correlationType: rel,
          confidence: 0.8,
          title: a.title,
        };
        clusters.push(cluster);

        if (!crossRefs.has(a.id)) crossRefs.set(a.id, []);
        if (!crossRefs.has(b.id)) crossRefs.set(b.id, []);
        crossRefs.get(a.id)!.push(b.id);
        crossRefs.get(b.id)!.push(a.id);
      }
    }
  }

  return { clusters, crossRefs };
}

function findCorrelation(a: NormalizedEvent, b: NormalizedEvent): "meeting-email" | "pr-slack" | "contact" | null {
  if (a.platform === "calendar" && b.category === "email") {
    if (normalizeText(a.title).includes(normalizeText(b.title.substring(0, 30)))) {
      return "meeting-email";
    }
  }

  if ((a.platform === "github" || b.platform === "github") && (a.platform === "slack" || b.platform === "slack")) {
    const gh = a.platform === "github" ? a : b;
    const slack = a.platform === "slack" ? a : b;
    const prNum = extractPRNumber(slack.title);
    if (prNum && gh.metadata.github?.prNumber === prNum) {
      return "pr-slack";
    }
    const repo = extractRepoName(slack.title);
    if (repo && gh.metadata.github?.repo === repo) {
      return "pr-slack";
    }
  }

  if (a.sender.email && b.sender.email && a.sender.email === b.sender.email && a.platform !== b.platform) {
    return "contact";
  }

  return null;
}

export function applyCorrelations(events: NormalizedEvent[], crossRefs: Map<string, string[]>): NormalizedEvent[] {
  return events.map(event => ({
    ...event,
    crossRefs: crossRefs.get(event.id) || event.crossRefs,
  }));
}
