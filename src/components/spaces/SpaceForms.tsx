"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSpaceAction, manageSpaceAction } from "@/app/actions/spaces";
import { useApp } from "../shell/AppContext";
import { Button, Input, Textarea, Select, Field, Card } from "../ui/primitives";
import type { SpaceView } from "@/lib/types";

export function SpaceForm({
  space,
  onCreated,
}: {
  space?: SpaceView;
  onCreated?: (space: SpaceView) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(space?.name ?? "");
  const [description, setDescription] = useState(space?.description ?? "");
  const [icon, setIcon] = useState(space?.icon ?? "folder");
  const [color, setColor] = useState(space?.color ?? "#48786c");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSpaceAction(
            { name, description, icon, color },
            space?.id,
          );
          if (!r.ok) {
            setError(r.error);
            return;
          }
          const created = {
            id: r.data!.id,
            name,
            description,
            icon,
            color,
            status: "active" as const,
          };
          if (onCreated) onCreated(created);
          else router.push(`/spaces/${created.id}${space ? "" : "?first=1"}`);
          router.refresh();
        });
      }}
    >
      {!space && (
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Work", icon: "briefcase" },
            { name: "Personal", icon: "user" },
            { name: "School", icon: "graduation-cap" },
            { name: "Create My Own", icon: "folder" },
          ].map((p) => (
            <Button
              key={p.name}
              type="button"
              variant="secondary"
              onClick={() => {
                setName(p.name === "Create My Own" ? "" : p.name);
                setIcon(p.icon);
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}
      <Field label="Space Name" htmlFor="space-name">
        <Input
          id="space-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
      </Field>
      <Field label="Space Icon" htmlFor="space-icon">
        <Select
          id="space-icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        >
          {[
            "folder",
            "briefcase",
            "user",
            "graduation-cap",
            "plane",
            "building",
            "heart",
          ].map((i) => (
            <option key={i}>{i}</option>
          ))}
        </Select>
      </Field>
      <Field label="Space Description" htmlFor="space-description" optional>
        <Textarea
          id="space-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
      </Field>
      <Field label="Space Color" htmlFor="space-color">
        <Input
          id="space-color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      <Button loading={pending} type="submit">
        {space ? "Save changes" : "+ Create Minder Space"}
      </Button>
    </form>
  );
}
export function SpacePicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const { spaces } = useApp();
  const [extra, setExtra] = useState<SpaceView[]>([]);
  const [creating, setCreating] = useState(false);
  const choices = [
    ...spaces,
    ...extra.filter((s) => !spaces.some((a) => a.id === s.id)),
  ];
  return (
    <div className="space-y-3">
      <Field
        label="Where should I remember this?"
        htmlFor="reminder-space"
        error={error}
      >
        <Select
          id="reminder-space"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        >
          <option value="">Choose a Minder Space</option>
          {choices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setCreating(!creating)}
      >
        + Create New Space
      </Button>
      {creating && (
        <Card className="p-4">
          <p className="mb-3 text-sm">
            Save your reminder draft, then create a Space here.
          </p>
          <InlineSpaceCreate
            onCreated={(s) => {
              setExtra((v) => [...v, s]);
              onChange(s.id);
              setCreating(false);
            }}
          />
        </Card>
      )}
    </div>
  );
}
// This is inside the reminder form: use buttons rather than a nested HTML form.
function InlineSpaceCreate({
  onCreated,
}: {
  onCreated: (s: SpaceView) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("folder");
  const [color, setColor] = useState("#48786c");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Input
        aria-label="New Space name"
        placeholder="Space name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
      />
      <Select
        aria-label="New Space icon"
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
      >
        {[
          "folder",
          "briefcase",
          "user",
          "graduation-cap",
          "plane",
          "building",
          "heart",
        ].map((i) => (
          <option key={i}>{i}</option>
        ))}
      </Select>
      <Input
        type="color"
        aria-label="New Space color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <Textarea
        aria-label="New Space description"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={1000}
      />
      {error && <p role="alert">{error}</p>}
      <Button
        type="button"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await saveSpaceAction({ name, description, icon, color });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            onCreated({
              id: r.data!.id,
              name,
              description,
              icon,
              color,
              status: "active",
            });
          })
        }
      >
        Create Space
      </Button>
    </div>
  );
}
export function SpaceManagement({
  space,
  count,
}: {
  space: SpaceView;
  count: number;
}) {
  const { spaces } = useApp();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (action: "archive" | "restore" | "move" | "delete") =>
    start(async () => {
      const r = await manageSpaceAction(space.id, action, destination);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/spaces");
      router.refresh();
    });
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold">Manage Space</h2>
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={() => run(space.status === "active" ? "archive" : "restore")}
      >
        {space.status === "active" ? "Archive Space" : "Restore Space"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setConfirm(!confirm)}
      >
        Delete Space
      </Button>
      {confirm && (
        <Card className="space-y-3 p-5">
          <p className="font-semibold">
            This Space contains {count} reminders, including historical periods.
          </p>
          <p>
            Move them with their history and attachments, or permanently delete
            the Space and all its reminders. Deletion cannot be undone.
          </p>
          <Select
            aria-label="Move reminders to another Space"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Choose destination</option>
            {spaces
              .filter((s) => s.id !== space.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
          <Button
            loading={pending}
            disabled={!destination}
            type="button"
            onClick={() => run("move")}
          >
            Move reminders and delete Space
          </Button>
          <Button loading={pending} type="button" onClick={() => run("delete")}>
            Permanently delete Space and its reminders
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirm(false)}
          >
            Cancel
          </Button>
        </Card>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
