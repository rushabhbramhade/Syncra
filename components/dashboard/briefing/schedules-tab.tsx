"use client";

import React, { useState } from "react";
import { BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { ScheduleList } from "./schedule-list";
import { NewScheduleDialog } from "./new-schedule-dialog";
import { Plus } from "lucide-react";

interface SchedulesTabProps {
  schedules: BriefingScheduleRecord[];
  onToggle: (scheduleId: string, currentVal: boolean) => void;
  onDelete: (scheduleId: string) => void;
  onAdd: (data: {
    id?: string;
    name: string;
    goal: string;
    frequency: string;
    timezone: string;
    integrations: string[];
    categories: string[];
  }) => Promise<void>;
  onRunNow: (scheduleId: string) => Promise<void>;
  isSubmitting: boolean;
}

export function SchedulesTab({ schedules, onToggle, onDelete, onAdd, onRunNow, isSubmitting }: SchedulesTabProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BriefingScheduleRecord | null>(null);

  const handleEdit = (schedule: BriefingScheduleRecord) => {
    setEditingSchedule(schedule);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingSchedule(null);
  };

  const handleSubmit = async (data: {
    id?: string;
    name: string;
    goal: string;
    frequency: string;
    timezone: string;
    integrations: string[];
    categories: string[];
  }) => {
    await onAdd(data);
    handleCloseDialog();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-black text-xl text-secondary">Automated Briefings</h3>
          <p className="text-[13px] font-medium text-text-slate mt-1">Configure schedules for automatic AI-generated briefings.</p>
        </div>
        <button
          onClick={() => { setEditingSchedule(null); setShowDialog(true); }}
          className="flex items-center gap-2 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-5 shadow-md hover:translate-y-[-1px] active:translate-y-0 duration-150"
        >
          <Plus className="w-4 h-4" />
          <span>New Schedule</span>
        </button>
      </div>

      <ScheduleList
        schedules={schedules}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={handleEdit}
        onRunNow={onRunNow}
      />

      <NewScheduleDialog
        isOpen={showDialog}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        editSchedule={editingSchedule}
      />
    </div>
  );
}
