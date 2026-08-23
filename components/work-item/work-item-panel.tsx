"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { dueLabel, isOverdue, relativeTime } from "@/lib/dates";
import type { WorkItem } from "@/lib/types";
import { StatusChip, WorkItemRef } from "@/components/shared/badges";
import {
  AssigneeSelect,
  DateField,
  Field,
  PrioritySelect,
  StatusSelect,
  TypeSelect,
} from "./controls";

export function WorkItemPanel({
  item,
  onClose,
  onPatch,
  onDelete,
}: {
  item: WorkItem | null;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<WorkItem>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        // Without this the panel opens with the whole task name selected,
        // one keystroke away from wiping it.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]"
      >
        {item && (
          // Keyed by id so switching cards starts with that card's text,
          // rather than syncing local state from props in an effect.
          <PanelBody
            key={item.id}
            item={item}
            onPatch={onPatch}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({
  item,
  onPatch,
  onDelete,
}: {
  item: WorkItem;
  onPatch: (id: string, patch: Partial<WorkItem>) => void;
  onDelete: (id: string) => void;
}) {
  // Title and description are held locally and committed on blur so every
  // keystroke does not become a write to the sheet.
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);

  const patch = (p: Partial<WorkItem>) => onPatch(item.id, p);
  const overdue = isOverdue(item);

  return (
    <>
      <SheetHeader className="shrink-0 gap-2 border-b border-rule px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <WorkItemRef refNumber={item.ref} />
          <StatusChip status={item.status} />
        </div>
        <SheetTitle className="sr-only">{item.title}</SheetTitle>
        <SheetDescription className="sr-only">
          Edit work item MON-{item.ref}
        </SheetDescription>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim();
            if (next && next !== item.title) patch({ title: next });
            else if (!next) setTitle(item.title);
          }}
          aria-label="Task name"
          placeholder="Name this task"
          className="-mx-1 rounded px-1 text-[17px] leading-snug font-semibold tracking-[-0.01em] hover:bg-muted/60 focus:bg-muted/60 focus-visible:outline-none"
        />
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== item.description) patch({ description });
            }}
            placeholder="What needs doing, and anything the next person should know."
            className="min-h-24 resize-y bg-card text-[13px] leading-relaxed"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <StatusSelect
              value={item.status}
              onChange={(status) => patch({ status })}
            />
          </Field>
          <Field label="Primary person">
            <AssigneeSelect
              value={item.assigneeId}
              onChange={(assigneeId) => patch({ assigneeId })}
            />
          </Field>
          <Field label="Priority">
            <PrioritySelect
              value={item.priority}
              onChange={(priority) => patch({ priority })}
            />
          </Field>
          <Field label="Functionality / Bug">
            <TypeSelect value={item.type} onChange={(type) => patch({ type })} />
          </Field>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="label-mono text-muted-foreground">Dates</span>
            <span
              className={cn(
                "font-mono text-[10.5px]",
                overdue
                  ? "font-semibold text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {dueLabel(item.plannedDate)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateField
              label="Created"
              value={item.createdDate}
              onChange={(createdDate) => patch({ createdDate })}
            />
            <DateField
              label="Started"
              value={item.startedDate}
              onChange={(startedDate) => patch({ startedDate })}
              readOnlyHint="auto"
            />
            <DateField
              label="Planned"
              value={item.plannedDate}
              onChange={(plannedDate) => patch({ plannedDate })}
            />
            <DateField
              label="Actual"
              value={item.actualDate}
              onChange={(actualDate) => patch({ actualDate })}
              readOnlyHint="auto"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Started and Actual stamp themselves when you move the card into
            In&nbsp;Progress or Completed. Override either here.
          </p>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-rule bg-muted/40 px-5 py-3">
        <span className="font-mono text-[10.5px] text-muted-foreground">
          {item.sheetRow ? `Sheet row ${item.sheetRow}` : "Not yet in sheet"}
          {" · "}
          saved {relativeTime(item.updatedAt)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-[12px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            onDelete(item.id);
            toast(`MON-${item.ref} deleted`, {
              description: item.title,
            });
          }}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </footer>
    </>
  );
}
