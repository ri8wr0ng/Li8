import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Id } from "@inkmark/backend/convex/_generated/dataModel";

type ShareRole = "view" | "edit";

export function ShareDialog({
  noteId,
  open,
  onOpenChange,
}: {
  noteId: Id<"notes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const shares = useQuery(api.notes.shares, open ? { id: noteId } : "skip");
  const share = useMutation(api.notes.share);
  const unshare = useMutation(api.notes.unshare);
  const setPublic = useMutation(api.notes.setPublic);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("view");
  const [submitting, setSubmitting] = useState(false);
  const [publicSubmitting, setPublicSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inviteEmail = email.trim();
    if (!inviteEmail) return;
    setSubmitting(true);
    try {
      await share({ id: noteId, email: inviteEmail, role });
      setEmail("");
      toast(`Shared with ${inviteEmail}`);
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateRole(personEmail: string | null, nextRole: ShareRole) {
    if (!personEmail) return;
    try {
      await share({ id: noteId, email: personEmail, role: nextRole });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  async function removePerson(userId: Id<"users">) {
    try {
      await unshare({ id: noteId, userId });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  async function togglePublicLink() {
    setPublicSubmitting(true);
    try {
      await setPublic({ id: noteId, enabled: !shares?.publicId });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    } finally {
      setPublicSubmitting(false);
    }
  }

  const publicUrl = shares?.publicId ? `${window.location.origin}/s/${shares.publicId}` : undefined;

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast("Link copied");
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share note</DialogTitle>
          <DialogDescription>
            Invite people by the email they sign in with, or turn on a public link.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            People
          </h3>
          <form className="flex items-center gap-2" onSubmit={(event) => void invite(event)}>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-w-0 flex-1"
              aria-label="Email address"
            />
            <Select value={role} onValueChange={(value) => setRole(parseRole(value))}>
              <SelectTrigger className="w-32" aria-label="Invite permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Can view</SelectItem>
                <SelectItem value="edit">Can edit</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="hanko" disabled={!email.trim() || submitting}>
              Invite
            </Button>
          </form>

          {shares?.people.length ? (
            <ul className="divide-y rounded-xl border">
              {shares.people.map((person) => (
                <li key={person.userId} className="flex min-w-0 items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.name ?? "Someone"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {person.email ?? "Email unavailable"}
                    </p>
                  </div>
                  {person.email ? (
                    <Select
                      value={person.role}
                      onValueChange={(value) => void updateRole(person.email, parseRole(value))}
                    >
                      <SelectTrigger
                        className="h-8 w-28"
                        aria-label={`Permission for ${person.name ?? person.email}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">Can view</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {person.role === "edit" ? "Can edit" : "Can view"}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${person.name ?? "person"}`}
                    onClick={() => void removePerson(person.userId)}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : shares ? (
            <p className="py-3 text-sm text-muted-foreground">Only you can see this note.</p>
          ) : null}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Public link
          </h3>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Anyone with the link can view</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!shares || publicSubmitting}
              onClick={() => void togglePublicLink()}
            >
              {shares?.publicId ? "Turn off" : "Create link"}
            </Button>
          </div>
          {publicUrl && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={publicUrl}
                aria-label="Public link"
                className="min-w-0 flex-1 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy link"
                onClick={() => void copyLink()}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function mutationErrorMessage(err: unknown) {
  return err instanceof ConvexError ? String(err.data) : "Something went wrong";
}

function parseRole(value: string): ShareRole {
  return value === "edit" ? "edit" : "view";
}
