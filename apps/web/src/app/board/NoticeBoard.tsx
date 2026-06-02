"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  UserPlus,
  Check,
  X,
  Mail,
  Users,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  SignBoard,
  Skeleton,
  useToast,
} from "@tomois/ui";
import { unfurl } from "@/lib/motion";
import {
  friends,
  parties,
  reroll,
  type FriendDTO,
  type PartyDTO,
  type PartyDetailDTO,
  type RerollCharacter,
} from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

export function NoticeBoard() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <FriendsPanel />
      <PartiesPanel />
    </div>
  );
}

// ---------- Friends ----------
function FriendsPanel() {
  const { toast } = useToast();
  const [list, setList] = useState<FriendDTO[] | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<FriendDTO | null>(null);

  async function refresh() {
    try {
      const l = await friends.list();
      setList(l);
    } catch (e) {
      setList([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function sendInvite() {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await friends.invite(email.trim());
      toast(`A raven flies to ${email.trim()}.`, { tone: "success" });
      setEmail("");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send invitation.";
      toast(msg.replace(/^\d+:\s*/, ""), { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function accept(f: FriendDTO) {
    try {
      await friends.accept(f.other_user_id);
      toast(`You and ${f.other_email ?? "they"} are now friends.`, {
        tone: "success",
      });
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't accept.", {
        tone: "error",
      });
    }
  }

  async function remove(f: FriendDTO) {
    try {
      await friends.remove(f.other_user_id);
      toast(`The bond is undone.`, { tone: "success" });
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't remove.", {
        tone: "error",
      });
    }
  }

  const grouped = useMemo(() => {
    const incoming = (list ?? []).filter(
      (f) => f.direction === "incoming" && f.status === "pending",
    );
    const outgoing = (list ?? []).filter(
      (f) => f.direction === "outgoing" && f.status === "pending",
    );
    const accepted = (list ?? []).filter((f) => f.status === "accepted");
    return { incoming, outgoing, accepted };
  }, [list]);

  return (
    <section aria-labelledby="friends-heading" className="space-y-5">
      <header>
        <h3
          id="friends-heading"
          className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-gold"
        >
          Friends
        </h3>
        <p className="mt-1 text-xs italic text-tavern-parchment/55">
          Send a raven by email. They&apos;ll appear here once accepted.
        </p>
      </header>

      <Card compact>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="invite-email">Invite by email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="traveller@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendInvite()}
            />
          </div>
          <div className="self-end">
            <Button onClick={sendInvite} disabled={submitting || !email.trim()}>
              <Mail className="h-4 w-4" />
              send raven
            </Button>
          </div>
        </div>
      </Card>

      {list === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : grouped.incoming.length + grouped.outgoing.length + grouped.accepted.length ===
        0 ? (
        <EmptyState
          icon={<UserPlus className="h-7 w-7" />}
          title="No friends yet"
          description="Invite someone by email — they'll appear here when they sign up or accept."
        />
      ) : (
        <>
          {grouped.incoming.length > 0 && (
            <FriendGroup title="Awaiting your answer">
              {grouped.incoming.map((f, i) => (
                <FriendRow key={f.other_user_id} friend={f} index={i}>
                  <Button size="sm" onClick={() => accept(f)}>
                    <Check className="h-3 w-3" />
                    accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(f)}
                    aria-label="Reject"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </FriendRow>
              ))}
            </FriendGroup>
          )}
          {grouped.outgoing.length > 0 && (
            <FriendGroup title="Awaiting their answer">
              {grouped.outgoing.map((f, i) => (
                <FriendRow key={f.other_user_id} friend={f} index={i}>
                  <Chip tone="muted">pending</Chip>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(f)}
                    aria-label="Cancel invitation"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </FriendRow>
              ))}
            </FriendGroup>
          )}
          {grouped.accepted.length > 0 && (
            <FriendGroup title="At the table">
              {grouped.accepted.map((f, i) => (
                <FriendRow key={f.other_user_id} friend={f} index={i}>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(f)}
                    aria-label="Remove friend"
                    className="rounded p-1.5 text-tavern-parchment/55 hover:bg-tavern-blood/30 hover:text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-blood"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </FriendRow>
              ))}
            </FriendGroup>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (confirmRemove) await remove(confirmRemove);
        }}
        title="Undo this friendship?"
        description="You'll both be removed from each other's lists. They won't be notified."
        confirmLabel="Undo"
        cancelLabel="Keep"
      />
    </section>
  );
}

function FriendGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 font-heading text-[0.65rem] uppercase tracking-[0.3em] text-tavern-parchment/55">
        {title}
      </h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FriendRow({
  friend,
  children,
  index = 0,
}: {
  friend: FriendDTO;
  children: React.ReactNode;
  index?: number;
}) {
  const label = friend.other_email ?? friend.other_user_id;
  return (
    <motion.li
      variants={unfurl}
      initial="hidden"
      animate="visible"
      custom={index}
      className="flex items-center gap-3 rounded-lg border border-tavern-stone/30 bg-tavern-night/50 px-3 py-2"
    >
      <Avatar size="sm" name={label} />
      <span className="flex-1 truncate text-sm text-tavern-parchment">
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </motion.li>
  );
}

// ---------- Parties ----------
function PartiesPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [list, setList] = useState<PartyDTO[] | null>(null);
  const [selected, setSelected] = useState<PartyDetailDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<PartyDTO | null>(null);

  async function refresh(selectId?: string) {
    try {
      const l = await parties.list();
      setList(l);
      if (selectId) {
        const detail = await parties.get(selectId);
        setSelected(detail);
      } else if (selected) {
        const detail = await parties.get(selected.id).catch(() => null);
        setSelected(detail);
      }
    } catch {
      setList([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function selectParty(id: string) {
    try {
      const detail = await parties.get(id);
      setSelected(detail);
    } catch (e) {
      toast("Couldn't open the party.", { tone: "error" });
    }
  }

  async function createParty() {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await parties.create(name);
      toast(`The party "${created.name}" gathers.`, { tone: "success" });
      setCreating(false);
      setNewName("");
      await refresh(created.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't found the party.", {
        tone: "error",
      });
    }
  }

  async function renameParty() {
    if (!selected) return;
    const name = renameValue.trim();
    if (!name || name === selected.name) {
      setRenaming(false);
      return;
    }
    try {
      await parties.rename(selected.id, name);
      toast("The party's banner is re-painted.", { tone: "success" });
      setRenaming(false);
      await refresh(selected.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Rename failed.", {
        tone: "error",
      });
    }
  }

  async function deleteParty(p: PartyDTO) {
    try {
      await parties.remove(p.id);
      toast(`${p.name} disbands.`, { tone: "success" });
      if (selected?.id === p.id) setSelected(null);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't disband.", {
        tone: "error",
      });
    }
  }

  const isLeader = !!user && selected?.owner_id === user.id;

  return (
    <section aria-labelledby="parties-heading" className="space-y-5">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3
            id="parties-heading"
            className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-gold"
          >
            Parties
          </h3>
          <p className="mt-1 text-xs italic text-tavern-parchment/55">
            Found a party, seat your friends, set your sheets.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          found a party
        </Button>
      </header>

      {list === null ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="No parties yet"
          description="Found one — gather your friends and bring your heroes."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              found the first party
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => selectParty(p.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
                  selected?.id === p.id
                    ? "border-tavern-gold/70 bg-tavern-night/80"
                    : "border-tavern-stone/30 bg-tavern-night/50 hover:border-tavern-gold/50"
                }`}
              >
                <div className="font-heading text-sm uppercase tracking-[0.25em] text-tavern-parchment">
                  {p.name}
                </div>
                <div className="mt-1 text-[0.65rem] italic text-tavern-parchment/55">
                  founded {new Date(p.created_at).toLocaleDateString()}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <PartyDetail
          party={selected}
          isLeader={isLeader}
          onChanged={() => refresh(selected.id)}
          onRequestRename={() => {
            setRenameValue(selected.name);
            setRenaming(true);
          }}
          onRequestDelete={() => setConfirmDelete(selected)}
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Found a new party"
        description="Pick a name your bards will remember."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              cancel
            </Button>
            <Button onClick={createParty}>found</Button>
          </>
        }
      >
        <div>
          <Label htmlFor="new-party-name">Name</Label>
          <Input
            id="new-party-name"
            placeholder="The Crooked Crown"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename party"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              cancel
            </Button>
            <Button onClick={renameParty}>save</Button>
          </>
        }
      >
        <div>
          <Label htmlFor="rename-party-input">New name</Label>
          <Input
            id="rename-party-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deleteParty(confirmDelete);
        }}
        title={`Disband ${confirmDelete?.name ?? "this party"}?`}
        description="Members are removed. This cannot be undone."
        confirmLabel="Disband"
      />
    </section>
  );
}

function PartyDetail({
  party,
  isLeader,
  onChanged,
  onRequestRename,
  onRequestDelete,
}: {
  party: PartyDetailDTO;
  isLeader: boolean;
  onChanged: () => Promise<void>;
  onRequestRename: () => void;
  onRequestDelete: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [acceptedFriends, setAcceptedFriends] = useState<FriendDTO[]>([]);
  const [characters, setCharacters] = useState<RerollCharacter[]>([]);
  const [addingUserId, setAddingUserId] = useState("");

  useEffect(() => {
    void Promise.all([
      friends.list().catch(() => [] as FriendDTO[]),
      reroll.listCharacters().catch(() => [] as RerollCharacter[]),
    ]).then(([fs, chs]) => {
      setAcceptedFriends(fs.filter((f) => f.status === "accepted"));
      setCharacters(chs);
    });
  }, [party.id]);

  const memberIds = new Set(party.members.map((m) => m.user_id));
  const friendsNotInParty = acceptedFriends.filter(
    (f) => !memberIds.has(f.other_user_id),
  );

  async function addMember() {
    if (!addingUserId) return;
    try {
      await parties.addMember(party.id, { user_id: addingUserId });
      setAddingUserId("");
      void onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't seat them.", {
        tone: "error",
      });
    }
  }

  async function assignCharacter(memberUserId: string, characterId: string) {
    try {
      await parties.patchMember(party.id, memberUserId, {
        character_id: characterId || null,
      });
      void onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't assign.", {
        tone: "error",
      });
    }
  }

  async function removeMember(memberUserId: string) {
    try {
      await parties.removeMember(party.id, memberUserId);
      void onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't remove.", {
        tone: "error",
      });
    }
  }

  return (
    <SignBoard title={party.name} subtitle={`${party.members.length} at the table`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isLeader && (
          <>
            <Button size="sm" variant="ghost" onClick={onRequestRename}>
              <Pencil className="h-3 w-3" />
              rename
            </Button>
            <Button size="sm" variant="danger" onClick={onRequestDelete}>
              <Trash2 className="h-3 w-3" />
              disband
            </Button>
          </>
        )}
      </div>

      <ul className="divide-y divide-tavern-oak/60">
        {party.members.map((m) => {
          const yours = m.user_id === user?.id;
          return (
            <li
              key={m.user_id}
              className="flex flex-wrap items-center gap-2 py-2"
            >
              <Avatar
                size="sm"
                name={m.email ?? m.user_id}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-tavern-parchment">
                  {m.email ?? m.user_id}
                </div>
                {m.role && (
                  <div className="text-[0.6rem] uppercase tracking-[0.25em] text-tavern-gold/70">
                    {m.role}
                  </div>
                )}
              </div>
              {yours ? (
                <select
                  aria-label="Pick your hero for this party"
                  value={m.character_id ?? ""}
                  onChange={(e) => assignCharacter(m.user_id, e.target.value)}
                  className="rounded border border-tavern-stone/35 bg-tavern-night px-2 py-1 text-xs text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
                >
                  <option value="">no hero</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Untitled"}
                    </option>
                  ))}
                </select>
              ) : m.character_id ? (
                <Chip tone="default">hero seated</Chip>
              ) : (
                <Chip tone="muted">no hero</Chip>
              )}
              {(isLeader || yours) && (
                <button
                  type="button"
                  onClick={() => removeMember(m.user_id)}
                  aria-label={yours ? "Leave party" : "Remove member"}
                  className="rounded p-1.5 text-tavern-parchment/55 hover:bg-tavern-blood/30 hover:text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-blood"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isLeader && friendsNotInParty.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={addingUserId}
            onChange={(e) => setAddingUserId(e.target.value)}
            className="flex-1 rounded border border-tavern-stone/35 bg-tavern-night px-2 py-1.5 text-xs text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
          >
            <option value="">add a friend…</option>
            {friendsNotInParty.map((f) => (
              <option key={f.other_user_id} value={f.other_user_id}>
                {f.other_email ?? f.other_user_id}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addMember} disabled={!addingUserId}>
            <UserPlus className="h-3 w-3" />
            seat them
          </Button>
        </div>
      )}
    </SignBoard>
  );
}
