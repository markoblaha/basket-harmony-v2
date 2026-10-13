import { useState, type FormEvent } from "react";
import { Check, Copy, Crown, Share2, UserMinus, X } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { Avatar, Banner, Button, Group, IconButton, PageHeader, Row, Section, Sheet, Spinner, TextField } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import {
  useCreateInvitation,
  useInvitations,
  useLeaveHousehold,
  useMembers,
  useRemoveMember,
  useRenameHousehold,
  useRevokeInvitation,
} from "@/features/household/api";
import { formatDateTime, t } from "@/i18n";

const shortDate = (iso: string) => formatDateTime(iso, { day: "numeric", month: "numeric" });

/** Správa domácnosti: názov, prepínanie domácností, členovia, pozvánky a odchod. */
export function HouseholdPage() {
  const me = useUserId();
  const { household, households, select } = useHousehold();
  const toast = useToast();
  const members = useMembers(household.id);
  const invitations = useInvitations(household.id);
  const createInvite = useCreateInvitation(household.id);
  const revokeInvite = useRevokeInvitation(household.id);
  const removeMember = useRemoveMember(household.id);
  const leave = useLeaveHousehold();
  const rename = useRenameHousehold(household.id);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [householdName, setHouseholdName] = useState<string | null>(null);

  const isOwner = members.data?.some((m) => m.user_id === me && m.role === "OWNER") ?? false;

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
    try {
      if (navigator.share) {
        await navigator.share({ title: t("household.shareTitle"), text: t("household.shareText", { name: household.name }), url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.show(t("household.linkCopied"), "success");
      }
    } catch {
      /* používateľ zdieľanie zrušil */
    }
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.show(t("household.linkCopied"), "success");
    } catch {
      toast.show(t("household.copyFailed"), "error");
    }
  }

  async function saveHouseholdName(e: FormEvent) {
    e.preventDefault();
    if (!householdName?.trim()) return;
    try {
      await rename.mutateAsync(householdName.trim());
      setHouseholdName(null);
      toast.show(t("household.renamed"), "success");
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
    <div className="flex flex-col gap-7 pb-8">
      <PageHeader title={t("household.title")} back="/more" />

      <Section>
        <Group>
          {isOwner ? (
            <form onSubmit={saveHouseholdName} className="flex items-end gap-2 p-4">
              <TextField
                className="flex-1"
                label={t("household.nameLabel")}
                value={householdName ?? household.name}
                onChange={(e) => setHouseholdName(e.target.value)}
                maxLength={60}
              />
              <Button
                type="submit"
                variant="secondary"
                className="mb-0.5 min-h-12"
                disabled={householdName === null || !householdName.trim() || householdName.trim() === household.name}
              >
                {t("common.save")}
              </Button>
            </form>
          ) : (
            <div className="p-4">
              <p className="text-sm font-medium text-text-2">{t("household.nameLabel")}</p>
              <p className="text-lg font-bold">{household.name}</p>
            </div>
          )}
        </Group>
      </Section>

      {households.length > 1 && (
        <Section title={t("household.yours")}>
          <Group>
            {households.map((h) => (
              <Row
                key={h.id}
                label={h.name}
                value={h.id === household.id ? <Check className="size-5 text-primary" strokeWidth={3} aria-hidden /> : undefined}
                onClick={() => select(h.id)}
              />
            ))}
          </Group>
        </Section>
      )}

      <Section title={t("household.members")}>
        {members.isPending ? (
          <Spinner />
        ) : (
          <Group>
            {members.data?.map((m) => (
              <div key={m.user_id} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <Avatar name={m.display_name} me={m.user_id === me} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.display_name} {m.user_id === me && <span className="text-text-3">{t("household.you")}</span>}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-text-3">
                    {m.role === "OWNER" ? (
                      <>
                        <Crown className="size-3.5" aria-hidden /> {t("household.owner")}
                      </>
                    ) : (
                      t("household.member")
                    )}
                  </p>
                </div>
                {isOwner && m.user_id !== me && (
                  <IconButton
                    label={t("household.remove", { name: m.display_name })}
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
          {t("household.invite")}
        </Button>
        {(invitations.data?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 px-1 text-sm text-text-2">{t("household.pendingInvites")}</p>
            <Group>
              {invitations.data?.map((inv) => (
                <div key={inv.id} className="flex min-h-12 items-center justify-between px-4 py-1.5 text-sm">
                  <span>{t("household.validUntil", { date: shortDate(inv.expires_at) })}</span>
                  <IconButton label={t("household.revokeInvite")} onClick={() => revokeInvite.mutate(inv.id)}>
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
          <Row icon={<UserMinus className="size-5" />} label={t("household.leave")} tone="danger" onClick={() => setConfirmLeave(true)} />
        </Group>
      </Section>

      <Sheet open={!!inviteUrl} onClose={() => setInviteUrl(null)} title={t("household.inviteReady")}>
        <div className="flex flex-col gap-4">
          <p className="text-text-2">{t("household.inviteHelp")}</p>
          <p className="break-all rounded-[var(--radius-control)] bg-surface p-3 font-mono text-sm select-all">{inviteUrl}</p>
          <Button size="lg" block onClick={share}>
            <Share2 className="size-5" aria-hidden /> {t("household.share")}
          </Button>
          <Button variant="secondary" block onClick={copy}>
            <Copy className="size-4" aria-hidden /> {t("household.copyLink")}
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirmLeave} onClose={() => setConfirmLeave(false)} title={t("household.leaveTitle")}>
        <div className="flex flex-col gap-4">
          <Banner tone="warning">{t("household.leaveWarning", { name: household.name })}</Banner>
          <Button variant="danger" size="lg" block loading={leave.isPending} onClick={doLeave}>
            {t("household.leaveConfirm")}
          </Button>
          <Button variant="ghost" block onClick={() => setConfirmLeave(false)}>
            {t("household.leaveStay")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
