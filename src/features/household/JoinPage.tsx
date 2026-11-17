import { useNavigate, useParams } from "react-router";
import { errorMessage } from "@/lib/errors";
import { Spinner } from "@/components/ui";
import { I } from "@/mockup/ui";
import { AuthLogo, AuthShell, Note } from "@/features/auth/shell";
import { t, type Key } from "@/i18n";
import { useAcceptInvitation, useInvitationPreview } from "./api";
import { rememberHousehold } from "./HouseholdProvider";

const STATE_TEXT: Record<string, { title: Key; text: Key }> = {
  INVALID: { title: "join.invalidTitle", text: "join.invalidText" },
  USED: { title: "join.usedTitle", text: "join.usedText" },
  EXPIRED: { title: "join.expiredTitle", text: "join.expiredText" },
};

/** Stránka, na ktorú vedie odkaz z pozvánky (/join/<token>). */
export function JoinPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();

  function openHousehold(id: string | undefined) {
    // Po vstupe chceme rovno vidieť domácnosť, do ktorej sme sa pridali.
    if (id) rememberHousehold(id);
    navigate("/", { replace: true });
  }

  async function join() {
    try {
      openHousehold(await accept.mutateAsync(token));
    } catch {
      /* chyba sa zobrazí cez accept.isError */
    }
  }

  return (
    <AuthShell>
      <AuthLogo />
      {preview.isPending && <Spinner label={t("join.checking")} />}
      {preview.isError && <Note tone="danger">{errorMessage(preview.error)}</Note>}
      {preview.data && preview.data.state === "VALID" && (
        <>
          <span className="auth-hero-ic" aria-hidden>
            <I n="users" />
          </span>
          <p className="meta">{t("join.invitedBy", { name: preview.data.invited_by ?? t("join.someone") })}</p>
          <h1 className="lt">{preview.data.household_name}</h1>
          <p className="meta">{t("join.willShare")}</p>
          {accept.isError && <Note tone="danger">{errorMessage(accept.error)}</Note>}
          <button type="button" className="btn pri full big" onClick={join} disabled={accept.isPending} aria-busy={accept.isPending || undefined}>
            {accept.isPending && <span className="auth-spin" aria-hidden />}
            {t("join.accept")}
          </button>
          <button type="button" className="lnk c" onClick={() => navigate("/", { replace: true })}>
            {t("join.decline")}
          </button>
        </>
      )}
      {preview.data && preview.data.state === "ALREADY_MEMBER" && (
        <>
          <Note tone="ok" title={preview.data.household_name ? t("join.alreadyMember", { name: preview.data.household_name }) : t("join.alreadyMemberPlain")} />
          <button type="button" className="btn pri full big" onClick={() => openHousehold(preview.data?.household_id)}>
            {t("join.open")}
          </button>
        </>
      )}
      {preview.data && STATE_TEXT[preview.data.state] && (
        <>
          <Note tone="warn" title={t(STATE_TEXT[preview.data.state]!.title)}>
            {t(STATE_TEXT[preview.data.state]!.text)}
          </Note>
          <button type="button" className="btn soft full big" onClick={() => navigate("/", { replace: true })}>
            {t("join.continueToApp")}
          </button>
        </>
      )}
    </AuthShell>
  );
}
