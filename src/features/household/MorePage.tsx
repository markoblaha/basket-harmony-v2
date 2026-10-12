import { useState, type FormEvent } from "react";
import { Copy, Crown, LogOut, Share2, UserMinus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, Group, IconButton, PageHeader, Section, Sheet, Spinner, TextField } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth, useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "./HouseholdProvider";
import {
  useCreateInvitation,
  useInvitations,
  useLeaveHousehold,
  useMembers,
  useProfiles,
  useRemoveMember,
  useRenameHousehold,
  useRevokeInvitation,
  useUpdateDisplayName,
} from "./api";

const date = (iso: string) => new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });

export function MorePage() {
  const { user } = useAuth();
  const me = useUserId();
  const { household, households, select } = useHousehold();
  const toast = useToast();
  const members = useMembers(household.id);
  const invitations = useInvitations(household.id);
  const profiles = useProfiles();
  const createInvite = useCreateInvitation(household.id);
  const revokeInvite = useRevokeInvitation(household.id);
  const removeMember = useRemoveMember(household.id);
  const leave = useLeaveHousehold();
  const rename = useRenameHousehold(household.id);
  const updateName = useUpdateDisplayName(me);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [myName, setMyName] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);

  const isOwner = members.data?.some((m) => m.user_id === me && m.role === "OWNER") ?? false;
  const currentName = profiles.data?.get(me) ?? "";

  async function invite() {
    try {
      const result = await createInvite.mutateAsync();
      setInviteUrl(result.url);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function share() {
    if (!inviteUrl) return;
    const text = `Pridaj sa do našej domácnosti „${household.name}“ v Basket Harmony:`;
    try {
      if (navigator.share) await navigator.share({ title: "Pozvánka", text, url: inviteUrl });
      else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.show("Odkaz skopírovaný", "success");
      }
    } catch {
      /* používateľ zdieľanie zrušil */
    }
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.show("Odkaz skopírovaný", "success");
    } catch {
      toast.show("Kopírovanie zlyhalo – označ odkaz a skopíruj ho ručne.", "error");
    }
  }

  async function saveMyName(e: FormEvent) {
    e.preventDefault();
    if (!myName?.trim()) return;
    try {
      await updateName.mutateAsync(myName.trim());
      setMyName(null);
      toast.show("Meno uložené", "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function saveHouseholdName(e: FormEvent) {
    e.preventDefault();
    if (!householdName?.trim()) return;
    try {
      await rename.mutateAsync(householdName.trim());
      setHouseholdName(null);
      toast.show("Domácnosť premenovaná", "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function doLeave() {
    try {
      await leave.mutateAsync(household.id);
      setConfirmLeave(false);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title="Viac" />

      <Section title="Môj účet">
        <Group>
          <form onSubmit={saveMyName} className="flex items-end gap-2 p-4">
            <TextField
              className="flex-1"
              label="Moje meno"
              value={myName ?? currentName}
              onChange={(e) => setMyName(e.target.value)}
              maxLength={60}
            />
            <Button type="submit" variant="secondary" className="mb-0.5 min-h-12" disabled={myName === null || !myName.trim() || myName.trim() === currentName}>
              Uložiť
            </Button>
          </form>
          <p className="px-4 py-3 text-sm text-text-2">{user?.email}</p>
        </Group>
      </Section>

      <Section title="Domácnosť">
        <Group>
          {households.length > 1 && (
            <div className="flex flex-wrap gap-2 p-4">
              {households.map((h) => (
                <Button key={h.id} variant={h.id === household.id ? "primary" : "secondary"} onClick={() => select(h.id)}>
                  {h.name}
                </Button>
              ))}
            </div>
          )}
          {isOwner ? (
            <form onSubmit={saveHouseholdName} className="flex items-end gap-2 p-4">
              <TextField className="flex-1" label="Názov domácnosti" value={householdName ?? household.name} onChange={(e) => setHouseholdName(e.target.value)} maxLength={60} />
              <Button type="submit" variant="secondary" className="mb-0.5 min-h-12" disabled={householdName === null || !householdName.trim() || householdName.trim() === household.name}>
                Uložiť
              </Button>
            </form>
          ) : (
            <p className="p-4 font-semibold">{household.name}</p>
          )}
        </Group>
      </Section>

      <Section title="Členovia">
        {members.isPending ? (
          <Spinner />
        ) : (
          <Group>
            {members.data?.map((m) => (
              <div key={m.user_id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary" aria-hidden>
                  {m.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.display_name} {m.user_id === me && <span className="text-text-3">(ty)</span>}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-text-3">
                    {m.role === "OWNER" ? (
                      <>
                        <Crown className="size-3.5" aria-hidden /> vlastník
                      </>
                    ) : (
                      "člen"
                    )}
                  </p>
                </div>
                {isOwner && m.user_id !== me && (
                  <IconButton
                    label={`Odobrať ${m.display_name}`}
                    onClick={() =>
                      removeMember.mutate(m.user_id, {
                        onError: (err) => toast.show(errorMessage(err), "error"),
                      })
                    }
                  >
                    <UserMinus className="size-5" />
                  </IconButton>
                )}
              </div>
            ))}
          </Group>
        )}
        <Button className="mt-3" block onClick={invite} loading={createInvite.isPending}>
          Pozvať člena
        </Button>
        {(invitations.data?.length ?? 0) > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 px-1 text-sm text-text-2">Nevyužité pozvánky</p>
            <Group>
              {invitations.data?.map((inv) => (
                <div key={inv.id} className="flex min-h-12 items-center justify-between px-4 py-1.5 text-sm">
                  <span>Platí do {date(inv.expires_at)}</span>
                  <IconButton label="Zrušiť pozvánku" onClick={() => revokeInvite.mutate(inv.id)}>
                    <X className="size-4" />
                  </IconButton>
                </div>
              ))}
            </Group>
          </div>
        )}
      </Section>

      <Section>
        <Group>
          <button type="button" onClick={() => supabase.auth.signOut()} className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-pressed">
            <LogOut className="size-5 text-text-2" aria-hidden /> Odhlásiť sa
          </button>
          <button type="button" onClick={() => setConfirmLeave(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-danger active:bg-pressed">
            <UserMinus className="size-5" aria-hidden /> Odísť z domácnosti
          </button>
        </Group>
      </Section>

      <Sheet open={!!inviteUrl} onClose={() => setInviteUrl(null)} title="Pozvánka je pripravená">
        <div className="flex flex-col gap-4">
          <p className="text-text-2">Pošli tento odkaz osobe, ktorú chceš pozvať. Platí 7 dní a dá sa použiť iba raz.</p>
          <p className="break-all rounded-[var(--radius-control)] bg-surface p-3 font-mono text-sm select-all">{inviteUrl}</p>
          <Button size="lg" block onClick={share}>
            <Share2 className="size-5" aria-hidden /> Zdieľať
          </Button>
          <Button variant="secondary" block onClick={copy}>
            <Copy className="size-4" aria-hidden /> Kopírovať odkaz
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Odísť z domácnosti?">
        <div className="flex flex-col gap-4">
          <Banner tone="warning">
            Stratíš prístup k zoznamom a nákupom domácnosti „{household.name}“. Ak si posledný člen, domácnosť sa zruší aj so všetkými údajmi.
          </Banner>
          <Button variant="danger" size="lg" block loading={leave.isPending} onClick={doLeave}>
            Odísť
          </Button>
          <Button variant="ghost" block onClick={() => setConfirmLeave(false)}>
            Zostať
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
