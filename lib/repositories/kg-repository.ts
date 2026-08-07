import type { AdminDb } from "./types";
import { createAdminDb } from "@/lib/db";

/**
 * Knowledge graph store — nodes and edges with weighted, time-stamped
 * relations. Merging: unique (integration_id, kind, label) per node;
 * edges unique per (source, target, relation).
 */
export interface KgNodeInput {
  user_id: string;
  integration_id: string;
  kind: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface KgEdgeInput {
  user_id: string;
  integration_id: string;
  source_node_id: string;
  target_node_id: string;
  relation: string;
  weight?: number;
}

export class KgRepository {
  private db: AdminDb;

  constructor(db: AdminDb) {
    this.db = db;
  }

  async upsertNode(node: KgNodeInput): Promise<string> {
    const { data, error } = await this.db.database
      .from("kg_nodes")
      .upsert(
        { ...node, properties: node.properties ?? {} },
        { onConflict: "integration_id,kind,label" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`[Kg] node upsert failed: ${error.message}`);
    return data.id as string;
  }

  async upsertEdge(edge: KgEdgeInput): Promise<void> {
    const { error } = await this.db.database
      .from("kg_edges")
      .upsert(
        { ...edge, weight: edge.weight ?? 1, last_seen_at: new Date().toISOString() },
        { onConflict: "source_node_id,target_node_id,relation" }
      );
    if (error) throw new Error(`[Kg] edge upsert failed: ${error.message}`);
  }

  /** Get node id by (integration, kind, label); null when absent. */
  async findNodeId(integrationId: string, kind: string, label: string): Promise<string | null> {
    const { data, error } = await this.db.database
      .from("kg_nodes")
      .select("id")
      .eq("integration_id", integrationId)
      .eq("kind", kind)
      .eq("label", label)
      .maybeSingle();
    if (error || !data) return null;
    return data.id as string;
  }

  /** One-hop expansion from a node — the core graph traversal primitive. */
  async neighbors(nodeId: string, relation?: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    let query = this.db.database
      .from("kg_edges")
      .select("target_node_id, relation, weight, kg_nodes!kg_edges_target_node_id_fkey(*)")
      .eq("source_node_id", nodeId)
      .order("weight", { ascending: false })
      .limit(limit);
    if (relation) query = query.eq("relation", relation);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as Array<Record<string, unknown>>;
  }

  async deleteForIntegration(integrationId: string): Promise<void> {
    await this.db.database.from("kg_edges").delete().eq("integration_id", integrationId);
    await this.db.database.from("kg_nodes").delete().eq("integration_id", integrationId);
  }
}

export function getKgRepo(): KgRepository {
  return new KgRepository(createAdminDb());
}
