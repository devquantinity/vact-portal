"use client";

import { useActionState, useState, useTransition } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createDocumentTypeAction,
  deleteDocumentTypeAction,
  reorderDocumentTypesAction,
  toggleDocumentTypeAction,
  updateDocumentTypeAction,
} from "@/actions/document-types";
import type { ActionState } from "@/lib/action-utils";
import { ALLOWED_EXTENSIONS } from "@/lib/files/extensions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { EmptyState } from "@/components/shared/empty-state";

export type DocumentTypeRow = {
  id: string;
  name: string;
  description: string | null;
  acceptedExtensions: string[];
  maxSizeMb: number;
  allowMultipleFiles: boolean;
  active: boolean;
  requestCount: number;
};

export function DocumentTypesPanel({ items: initial }: { items: DocumentTypeRow[] }) {
  const [items, setItems] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  const [pending, startTransition] = useTransition();
  if (prevInitial !== initial) {
    // Server data changed (after a save or revalidation): adopt it.
    setPrevInitial(initial);
    setItems(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      const res = await reorderDocumentTypesAction(next.map((i) => i.id));
      if (res && !res.ok) toast.error(res.error);
    });
  }

  function toggle(id: string, active: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active } : i)));
    startTransition(async () => {
      const res = await toggleDocumentTypeAction(id, active);
      if (res?.ok) toast.success(res.message);
      else if (res) toast.error(res.error);
    });
  }

  function remove(item: DocumentTypeRow) {
    startTransition(async () => {
      const res = await deleteDocumentTypeAction(item.id);
      if (res?.ok) toast.success(res.message);
      else if (res) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Drag to change the order shown to staff when creating a request.</p>
        <DocumentTypeDialog />
      </div>
      {items.length === 0 ? (
        <EmptyState title="No document types" description="Create the kinds of documents V ACT asks clients for." action={<DocumentTypeDialog />} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className={cn("space-y-2", pending && "opacity-80")}>
              {items.map((item) => (
                <SortableRow key={item.id} item={item} onToggle={toggle} onDelete={remove} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({
  item,
  onToggle,
  onDelete,
}: {
  item: DocumentTypeRow;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (item: DocumentTypeRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-3 shadow-xs",
        isDragging && "relative z-10 shadow-md",
        !item.active && "opacity-70",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Reorder ${item.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{item.name}</p>
          {item.allowMultipleFiles ? <Badge variant="secondary">Multiple files</Badge> : null}
          <Badge variant="outline" className="text-muted-foreground">
            {item.acceptedExtensions.map((e) => e.toUpperCase()).join(" · ")} · up to {item.maxSizeMb} MB
          </Badge>
        </div>
        {item.description ? <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{item.description}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-muted-foreground">{item.active ? "Active" : "Inactive"}</span>
        <Switch checked={item.active} onCheckedChange={(v) => onToggle(item.id, v)} aria-label={`Toggle ${item.name}`} />
        <DocumentTypeDialog item={item} />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${item.name}`}
          disabled={item.requestCount > 0}
          title={item.requestCount > 0 ? `Used by ${item.requestCount} requests` : "Delete"}
          onClick={() => onDelete(item)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function DocumentTypeDialog({ item }: { item?: DocumentTypeRow }) {
  const [open, setOpen] = useState(false);
  const action = item ? updateDocumentTypeAction.bind(null, item.id) : createDocumentTypeAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const errors = (!state?.ok && state?.fieldErrors) || {};
  const [exts, setExts] = useState<string[]>(item?.acceptedExtensions ?? ["pdf"]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setExts(item?.acceptedExtensions ?? ["pdf"]);
      }}
    >
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> New document type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit document type" : "New document type"}</DialogTitle>
          <DialogDescription>What clients see when this document is requested, and which files are accepted.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Field label="Name" htmlFor="dt-name" error={errors.name}>
            <Input id="dt-name" name="name" defaultValue={item?.name ?? ""} required />
          </Field>
          <Field label="Description for clients" htmlFor="dt-desc" error={errors.description}>
            <Textarea id="dt-desc" name="description" defaultValue={item?.description ?? ""} rows={2} />
          </Field>
          <Field label="Accepted file types" error={errors.acceptedExtensions}>
            <input type="hidden" name="acceptedExtensions" value={exts.join(",")} />
            <div className="flex flex-wrap gap-2">
              {ALLOWED_EXTENSIONS.map((ext) => {
                const on = exts.includes(ext);
                return (
                  <button
                    key={ext}
                    type="button"
                    onClick={() => setExts((prev) => (on ? prev.filter((e) => e !== ext) : [...prev, ext]))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                    aria-pressed={on}
                  >
                    .{ext}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Max size (MB)" htmlFor="dt-max" error={errors.maxSizeMb}>
              <Input id="dt-max" name="maxSizeMb" type="number" min={1} max={100} defaultValue={item?.maxSizeMb ?? 10} />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="allowMultipleFiles" defaultChecked={item?.allowMultipleFiles ?? false} />
                Allow several files per request
              </label>
            </div>
          </div>
          <ActionFeedback state={state} onSuccess={() => setOpen(false)} />
          <div className="flex justify-end">
            <SubmitButton pendingText="Saving…">{item ? "Save" : "Create"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
