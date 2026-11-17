import { useState } from "react";
import { useNavigate } from "react-router";
import { Copy, Link2, Share2, UserPlus } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { Spinner } from "@/components/ui";
import { BottomSheet, ConfirmDialog, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import {
  useCreateInvitation, useInvitations, useLeaveHousehold, useMembers, useRemoveMember, useRenameHousehold, useRevokeInvitation, type Member,
} from "@/features/household/api";
import { formatDateTime, t } from "@/i18n";
import { Back, I, IB, MkHeader } from "@/mockup/ui";
import { Av, Btn } from "@/mockup/kit";
import { useTheme } from "@/theme/ThemeProvider";

const shortDate = (iso: string) => formatDateTime(iso, { day: "numeric", month: "numeric" });
const dayDate = (iso: string) => formatDateTime(iso, { weekday: "short", day: "numeric", month: "numeric" });

/** V2 – Domácnosť: názov, členovia (vlastník môže odobrať), pozvánky a odchod. */
export function HouseholdPage() {
  const me = useUserId();
  const navigate = useNavigate();
  const { household } = useHousehold();
  const toast = useToast();
  const members = useMembers(household.id);
  const invitations = useInvitations(household.id);
  const createInvite = useCreateInvitation(household.id);
  const revokeInvite = useRevokeInvitation(household.id);
  const removeMember = useRemoveMember(household.id);
  const leave = useLeaveHousehold();
  const rename = useRenameHousehold(household.id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(household.name);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [invite, setInvite] = useState<{ url: string; expires: string } | null>(null);

  const isOwner = members.data?.some((m) => m.user_id === me && m.role === "OWNER") ?? false;
  const others = (members.data ?? []).filter((m) => m.user_id !== me).length;

  async function saveName() {
    const next = name.trim();
    if (!next || next === household.name) {
      setEditing(false);
      setName(household.name);
      return;
    }
    try {
      await rename.mutateAsync(next);
      setEditing(false);
      toast.show(t("household.renamed"), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function createInvitation() {
    try {
      const result = await createInvite.mutateAsync();
      setInvite({ url: result.url, expires: result.expires_at });
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function doRemove() {
    if (!removing) return;
    try {
      await removeMember.mutateAsync(removing.user_id);
      setRemoving(null);
      toast.show(t("household.removed"), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function doLeave() {
    const leftName = household.name;
    try {
      await leave.mutateAsync(household.id);
      setConfirmLeave(false);
      toast.show(t("household.left", { name: leftName }));
      navigate("/");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const gl = useTheme().style === "glass" ? " glass2" : "";
  return (
    <div className="stack">
      <MkHeader title={t("household.title")} back={<Back label={t("more.title")} onClick={() => navigate("/more")} />}>
        <div className="h2 sm">{t("household.nameSection")}</div>
        <div className={`lst${gl}`}>
          <div className="row">
            {editing ? (
              <div className="fl row grow">
                <input
                  autoFocus
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") {
                      setEditing(false);
                      setName(household.name);
                    }
                  }}
                  aria-label={t("household.nameLabel")}
                />
                <button type="button" className="btn pri round" onClick={() => void saveName()} disabled={rename.isPending} aria-label={t("common.save")}>
                  <I n="check" w="bold" />
                </button>
              </div>
            ) : (
              <>
                <span className="th ic">
                  <I n="house" />
                </span>
                <div className="tx">
                  <b>{household.name}</b>
                  {!isOwner && <span className="sub">{t("household.ownerEdits")}</span>}
                </div>
                {isOwner && (
                  <IB
                    n="pencil-simple"
                    cls="flat sm"
                    label={t("household.rename")}
                    onClick={() => {
                      setName(household.name);
                      setEditing(true);
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <div className="h2 sm">{t("household.members")}</div>
        {members.isPending ? (
          <Spinner />
        ) : (
          <div className={`lst${gl}`}>
            {members.data?.map((m) => (
              <div key={m.user_id} className="row">
                <Av id={m.user_id} name={m.display_name} s={40} />
                <div className="tx">
                  <b>
                    {m.display_name}
                    {m.user_id === me ? ` ${t("household.you")}` : ""}
                  </b>
                  <span className="sub">{m.role === "OWNER" ? t("household.ownerRole") : t("household.memberRole")}</span>
                </div>
                {isOwner && m.user_id !== me && (
                  <IB n="x" cls="flat sm" label={t("household.removeFromHousehold") + ": " + m.display_name} onClick={() => setRemoving(m)} />
                )}
              </div>
            ))}
            <button type="button" className="row tap" onClick={createInvitation} disabled={createInvite.isPending}>
              <span className="th ic">
                <I n="user-plus" />
              </span>
              <div className="tx">
                <b className="acc">{t("household.invite")}</b>
              </div>
              {createInvite.isPending ? <Spinner /> : <I n="caret-right" w="bold" cls="chev" />}
            </button>
          </div>
        )}

        {(invitations.data?.length ?? 0) > 0 && (
          <>
            <div className="h2 sm">{t("household.pendingInvites")}</div>
            <div className={`lst${gl}`}>
              {invitations.data?.map((inv) => (
                <div key={inv.id} className="row">
                  <span className="th ic">
                    <I n="link" />
                  </span>
                  <div className="tx">
                    <b>{t("household.inviteItem", { date: shortDate(inv.created_at) })}</b>
                    <span className="sub">{t("household.inviteValid", { date: shortDate(inv.expires_at) })}</span>
                  </div>
                  <Btn
                    cls="soft sm"
                    onClick={() =>
                      revokeInvite.mutate(inv.id, {
                        onSuccess: () => toast.show(t("household.inviteRevoked")),
                        onError: (err) => toast.show(errorMessage(err), "error"),
                      })
                    }
                  >
                    {t("common.cancel")}
                  </Btn>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={`lst${gl}`}>
          <button type="button" className="row tap" onClick={() => setConfirmLeave(true)}>
            <span className="th ic dng">
              <I n="sign-out" />
            </span>
            <div className="tx">
              <b className="dng">{t("household.leave")}</b>
            </div>
          </button>
        </div>
      </MkHeader>
      <div className="tab-space" />

      <BottomSheet open={!!invite} onClose={() => setInvite(null)} label={t("household.inviteReady")}>
        {invite && <InviteSheet url={invite.url} expires={invite.expires} householdName={household.name} onClose={() => setInvite(null)} />}
      </BottomSheet>

      <ConfirmDialog
        open={!!removing}
        title={t("household.removeTitle", { name: removing?.display_name ?? "" })}
        body={t("household.removeBody")}
        confirmLabel={t("kit.remove")}
        danger
        busy={removeMember.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void doRemove()}
      />
      <ConfirmDialog
        open={confirmLeave}
        title={t("household.leaveTitle")}
        body={others === 0 ? t("household.leaveLastBody") : isOwner ? t("household.leaveOwnerBody") : t("household.leaveBody")}
        confirmLabel={t("household.leaveConfirm")}
        danger
        busy={leave.isPending}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => void doLeave()}
      />
    </div>
  );
}

/** V2I – pozvánka člena: odkaz platný 7 dní, kopírovanie a zdieľanie (WhatsApp, Messenger, SMS…). */
function InviteSheet({ url, expires, householdName, onClose }: { url: string; expires: string; householdName: string; onClose: () => void }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.show(t("household.linkCopied"), "success");
    } catch {
      toast.show(t("household.copyFailed"), "error");
    }
  }
  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: t("household.shareTitle"), text: t("household.shareText", { name: householdName }), url });
    } catch {
      /* používateľ zdieľanie zrušil */
    }
  }
  return (
    <>
      <SheetHeader title={t("household.inviteReady")} sub={t("household.inviteTo", { name: householdName })} onClose={onClose} />
      <div className="sheet-body stack" style={{ alignItems: "center", gap: 16 }}>
        <span className="mr-invite-ic" aria-hidden>
          <UserPlus size={30} strokeWidth={1.8} />
        </span>
        <span className="t-sm t-2" style={{ textAlign: "center", maxWidth: 280 }}>
          {t("household.inviteHelp2", { date: dayDate(expires) })}
        </span>
        <div className="card row g-8" style={{ padding: "8px 8px 8px 14px", width: "100%" }}>
          <Link2 size={17} className="t-3" style={{ flex: "none" }} />
          <span className="grow t-body fw-5 ellipsis num" style={{ userSelect: "all" }}>
            {url.replace(/^https?:\/\//, "")}
          </span>
          <button type="button" className="btn btn-soft btn-sm" onClick={copy}>
            <Copy size={15} /> {t("household.copy")}
          </button>
        </div>
        <button type="button" className="btn btn-ink btn-block btn-lg" onClick={share}>
          <Share2 size={18} /> {t("household.shareInvite")}
        </button>
      </div>
    </>
  );
}
