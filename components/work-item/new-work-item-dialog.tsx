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
  status: Status;
  priority: Priority;
  type: WorkType | null;
  plannedDate: string | null;
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
    status: defaultStatus,
    priority: "Medium",
    type: null,
    plannedDate: null,
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
      status: draft.status,
      priority: draft.priority,
      type: draft.type,
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
          <Field label="Functionality / Bug">
            <TypeSelect value={draft.type} onChange={(v) => set("type", v)} />
          </Field>
        </div>

        <DateField
          label="Planned date"
          value={draft.plannedDate}
          onChange={(v) => set("plannedDate", v)}
        />
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
