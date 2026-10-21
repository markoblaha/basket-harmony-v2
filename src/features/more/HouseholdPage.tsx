import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Check, Copy, Crown, Link2, LogOut, MoreHorizontal, Pencil, Share2, UserPlus, X } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { Spinner } from "@/components/ui";
import { BottomSheet, ConfirmDialog, PersonAvatar, ScreenHeader, SheetHeader } from "@/components/kit";
import { useToast } from "@/components/toast";
import { useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import {
  useCreateInvitation, useInvitations, useLeaveHousehold, useMembers, useRemoveMember, useRenameHousehold, useRevokeInvitation, type Member,
} from "@/features/household/api";
import { formatDateTime, t } from "@/i18n";

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
  const [menu, setMenu] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [invite, setInvite] = useState<{ url: string; expires: string } | null>(null);

  const isOwner = members.data?.some((m) => m.user_id === me && m.role === "OWNER") ?? false;
  const others = (members.data ?? []).filter((m) => m.user_id !== me).length;

  // Ponuka pri členovi sa zavrie ťuknutím kamkoľvek inam.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const id = window.setTimeout(() => document.addEventListener("click", close, { once: true }));
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [menu]);

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

  return (
    <div className="stack">
      <ScreenHeader title={t("household.title")} onBack={() => navigate("/more")} />
      <div className="stack g-20 pad" style={{ paddingTop: 4 }}>
        <div className="stack g-8">
          <span className="section-title">{t("household.nameSection")}</span>
          <div className="card row g-8" style={{ padding: "8px 8px 8px 16px", minHeight: 60 }}>
            {editing ? (
              <>
                <input
                  className="input grow"
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
                <button type="button" className="ibtn ink" onClick={() => void saveName()} disabled={rename.isPending} aria-label={t("common.save")}>
                  <Check size={18} />
                </button>
              </>
            ) : (
              <>
                <span className="grow t-h">{household.name}</span>
                {isOwner ? (
                  <button
                    type="button"
                    className="ibtn"
                    onClick={() => {
                      setName(household.name);
                      setEditing(true);
                    }}
                    aria-label={t("household.rename")}
                  >
                    <Pencil size={17} />
                  </button>
                ) : (
                  <span className="t-xs t-3" style={{ paddingRight: 8 }}>
                    {t("household.ownerEdits")}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="stack g-8">
          <span className="section-title">{t("household.members")}</span>
          {members.isPending ? (
            <Spinner />
          ) : (
            <div className="cells" style={{ overflow: "visible" }}>
              {members.data?.map((m) => (
                <div key={m.user_id} className="cell" style={{ position: "relative" }}>
                  <PersonAvatar person={{ id: m.user_id, name: m.display_name }} />
                  <span className="grow stack g-2">
                    <span className="t-body fw-5">
                      {m.display_name}
                      {m.user_id === me ? ` ${t("household.you")}` : ""}
                    </span>
                    <span className="row g-4 t-sm t-2">
                      {m.role === "OWNER" && <Crown size={13} />}
                      {m.role === "OWNER" ? t("household.ownerRole") : t("household.memberRole")}
                    </span>
                  </span>
                  {isOwner && m.user_id !== me && (
                    <button
                      type="button"
                      className="ibtn"
                      aria-label={t("household.options", { name: m.display_name })}
                      aria-expanded={menu === m.user_id}
                      onClick={() => setMenu(menu === m.user_id ? null : m.user_id)}
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  )}
                  {menu === m.user_id && (
                    <div className="card anim-pop mr-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="cell"
                        onClick={() => {
                          setMenu(null);
                          setRemoving(m);
                        }}
                      >
                        <X size={18} color="var(--red)" /> <span className="t-body t-red">{t("household.removeFromHousehold")}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="cell" onClick={createInvitation} disabled={createInvite.isPending}>
                <span className="cat-ic" style={{ background: "var(--ink)", color: "var(--on-ink)" }}>
                  <UserPlus size={18} />
                </span>
                <span className="grow t-body fw-6">{t("household.invite")}</span>
                {createInvite.isPending && <span className="spin t-3" style={{ width: 16, height: 16, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: 99 }} />}
              </button>
            </div>
          )}
        </div>

        {(invitations.data?.length ?? 0) > 0 && (
          <div className="stack g-8">
            <span className="section-title">{t("household.pendingInvites")}</span>
            <div className="cells">
              {invitations.data?.map((inv) => (
                <div key={inv.id} className="cell">
                  <span className="cat-ic">
                    <Link2 size={18} />
                  </span>
                  <span className="grow stack g-2">
                    <span className="t-body fw-5 num">{t("household.inviteItem", { date: shortDate(inv.created_at) })}</span>
                    <span className="t-sm t-2">{t("household.inviteValid", { date: shortDate(inv.expires_at) })}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() =>
                      revokeInvite.mutate(inv.id, {
                        onSuccess: () => toast.show(t("household.inviteRevoked")),
                        onError: (err) => toast.show(errorMessage(err), "error"),
                      })
                    }
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="cells">
          <button type="button" className="cell" onClick={() => setConfirmLeave(true)}>
            <span className="cat-ic" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              <LogOut size={18} />
            </span>
            <span className="grow t-body fw-6 t-red">{t("household.leave")}</span>
          </button>
        </div>
      </div>
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
