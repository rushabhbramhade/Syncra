"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { TaskExtractionService } from "@/lib/services/task-extraction-service";

export default function TasksPage() {
  const { user, dbUser } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!dbUser?.id) return;
    setIsLoading(true);
    try {
      const service = new TaskExtractionService();
      const userTasks = await service.getTasks(dbUser.id);
      setTasks(userTasks);
    } catch {
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [dbUser?.id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleToggle = async (taskId: string, currentStatus: string) => {
    if (!dbUser?.id) return;
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      const service = new TaskExtractionService();
      await service.updateTaskStatus(dbUser.id, taskId, newStatus);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch {}
  };

  const getDeadlineGroup = (task: any): string => {
    if (!task.deadline) return "no-deadline";
    const diff = new Date(task.deadline).getTime() - Date.now();
    if (diff < 0) return "overdue";
    if (diff < 86400000) return "today";
    if (diff < 604800000) return "this-week";
    return "later";
  };

  const groups: Record<string, any[]> = { overdue: [], today: [], "this-week": [], later: [], "no-deadline": [] };
  for (const t of tasks) groups[getDeadlineGroup(t)].push(t);

  if (isLoading) return (
    <div className="pb-10 font-sans max-w-4xl mx-auto animate-fade-in">
      <Skeleton className="h-10 w-48 mb-2 rounded-lg" />
      <Skeleton className="h-5 w-72 mb-8 rounded-lg" />
      {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full mb-3 rounded-xl" />)}
    </div>
  );

  return (
    <div className="pb-10 font-sans max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">Tasks</h1>
        <p className="text-text-slate text-[16px] font-medium">AI-extracted action items from your communications.</p>
      </div>

      {tasks.length === 0 ? (
        <Card className="neo-border bg-surface-white neo-shadow-md p-12 text-center">
          <ListTodo className="w-12 h-12 text-text-slate mx-auto mb-4" />
          <h2 className="text-xl font-bold text-secondary mb-2">No tasks yet</h2>
          <p className="text-text-slate">AI will extract action items from your emails, messages, and briefings.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([group, items]) =>
            items.length > 0 && (
              <div key={group}>
                <h2 className="font-bold text-secondary text-lg mb-3 capitalize">
                  {group === "overdue" && <><AlertTriangle className="w-4 h-4 inline text-error mr-1" /> Overdue</>}
                  {group === "today" && <><Clock className="w-4 h-4 inline text-warning mr-1" /> Today</>}
                  {group === "this-week" && <>This Week</>}
                  {group === "later" && <>Later</>}
                  {group === "no-deadline" && <>Unscheduled</>}
                </h2>
                <div className="space-y-2">
                  {items.map((task: any) => (
                    <Card key={task.id} className="neo-border bg-surface-white neo-shadow-sm p-4 flex items-start gap-3">
                      <button onClick={() => handleToggle(task.id, task.status)} className="mt-0.5 shrink-0">
                        {task.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-text-slate" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-secondary ${task.status === "completed" ? "line-through opacity-50" : ""}`}>{task.title}</p>
                        {task.description && <p className="text-text-slate text-[13px] mt-1">{task.description}</p>}
                        <div className="flex gap-3 mt-2 text-[11px] text-text-slate font-medium">
                          {task.source_platform && <span>via {task.source_platform}</span>}
                          {task.deadline && <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                          {task.owner && <span>Owner: {task.owner}</span>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
