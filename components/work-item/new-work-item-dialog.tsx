"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/lib/dates";
import { STARTED_STAGES } from "@/lib/constants";
import type { NewWorkItem, Priority, Status, WorkType } from "@/lib/types";
import {
  AssigneeSelect,
  DateField,
  Field,
  PrioritySelect,
  StatusSelect,
  TypeSelect,
} from "./controls";

interface Draft {
  title: string;
  description: string;
  assigneeId: string | null;
  secondaryAssigneeId: string | null;
  status: Status;
  priority: Priority;
  type: WorkType | null;
  plannedDate: string | null;
  storyPoints: number | null;
  notes: string;
}

export function NewWorkItemDialog({
  open,
  defaultStatus,
  defaultAssigneeId,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  defaultStatus: Status;
  defaultAssigneeId: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewWorkItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        {/* Keyed so opening from a different column starts a clean draft —
            the alternative is resetting state from inside an effect. */}
        <Composer
          key={`${defaultStatus}:${defaultAssigneeId ?? "none"}`}
          defaultStatus={defaultStatus}
          defaultAssigneeId={defaultAssigneeId}
          onCancel={() => onOpenChange(false)}
          onCreate={(input) => {
            onCreate(input);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Composer({
  defaultStatus,
  defaultAssigneeId,
  onCancel,
  onCreate,
}: {
  defaultStatus: Status;
  defaultAssigneeId: string | null;
  onCancel: () => void;
  onCreate: (input: NewWorkItem) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: "",
    description: "",
    assigneeId: defaultAssigneeId,
    secondaryAssigneeId: null,
    status: defaultStatus,
    priority: "Medium",
    type: null,
    plannedDate: null,
    storyPoints: null,
    notes: "",
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const valid = draft.title.trim().length > 0;

  function submit() {
    if (!valid) return;
    const title = draft.title.trim();
    onCreate({
      title,
      description: draft.description.trim(),
      assigneeId: draft.assigneeId,
      secondaryAssigneeId: draft.secondaryAssigneeId,
      status: draft.status,
      notes: draft.notes.trim(),
      priority: draft.priority,
      type: draft.type,
      storyPoints: draft.storyPoints,
      createdDate: todayIso(),
      startedDate: STARTED_STAGES.includes(draft.status) ? todayIso() : null,
      plannedDate: draft.plannedDate,
      actualDate: draft.status === "Completed" ? todayIso() : null,
    });
    toast.success("Work item added", {
      description: `${title} → ${draft.status}`,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-[16px]">New work item</DialogTitle>
        <DialogDescription className="text-[12.5px]">
          Lands in {draft.status}. Everything here maps to a column in the
          tracking sheet.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-1">
        <Field label="Task">
          <Input
            autoFocus
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="Short and specific — what is being done"
            className="h-9 bg-card text-[13px]"
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Context the next person will need. Optional."
            className="min-h-20 resize-y bg-card text-[13px] leading-relaxed"
          />
        </Field>

        {/* Left column is about the work, right column is about people, so
            Secondary person reads as a continuation of Primary person. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <StatusSelect
              value={draft.status}
              onChange={(v) => set("status", v)}
            />
          </Field>
          <Field label="Primary person">
            <AssigneeSelect
              value={draft.assigneeId}
              onChange={(v) => set("assigneeId", v)}
            />
          </Field>
          <Field label="Priority">
            <PrioritySelect
              value={draft.priority}
              onChange={(v) => set("priority", v)}
            />
          </Field>
          <Field label="Secondary person">
            <AssigneeSelect
              label="Secondary person"
              placeholder="Nobody"
              value={draft.secondaryAssigneeId}
              onChange={(v) => set("secondaryAssigneeId", v)}
            />
          </Field>
          <Field label="Functionality / Bug">
            <TypeSelect value={draft.type} onChange={(v) => set("type", v)} />
          </Field>
          <Field label="Story points">
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 1, 2, 3, 5"
              value={draft.storyPoints !== null ? draft.storyPoints : ""}
              onChange={(e) => {
                const val = e.target.value.trim();
                if (!val) {
                  set("storyPoints", null);
                } else {
                  const parsed = parseInt(val, 10);
                  set("storyPoints", Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
                }
              }}
              className="h-9 bg-card font-mono text-[13px]"
            />
          </Field>
          <DateField
            label="Planned date"
            value={draft.plannedDate}
            onChange={(v) => set("plannedDate", v)}
          />
        </div>

        <Field label="Notes">
          <Textarea
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything worth recording as the task moves. Optional."
            className="min-h-16 resize-y bg-card text-[13px] leading-relaxed"
          />
        </Field>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid}>
          Add work item
        </Button>
      </DialogFooter>
    </>
  );
}
