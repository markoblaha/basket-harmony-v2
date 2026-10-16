import { useNavigate, useParams } from "react-router";
import { Users } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, Spinner } from "@/components/ui";
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      {preview.isPending && <Spinner label={t("join.checking")} />}
      {preview.isError && <Banner tone="danger">{errorMessage(preview.error)}</Banner>}
      {preview.data && preview.data.state === "VALID" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Users className="size-8" aria-hidden />
          </div>
          <div>
            <p className="text-text-2">{t("join.invitedBy", { name: preview.data.invited_by ?? t("join.someone") })}</p>
            <h1 className="text-2xl font-semibold">{preview.data.household_name}</h1>
          </div>
          <p className="text-sm text-text-2">{t("join.willShare")}</p>
          {accept.isError && <Banner tone="danger">{errorMessage(accept.error)}</Banner>}
          <Button size="lg" block loading={accept.isPending} onClick={join}>
            {t("join.accept")}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/", { replace: true })}>
            {t("join.decline")}
          </Button>
        </div>
      )}
      {preview.data && preview.data.state === "ALREADY_MEMBER" && (
        <div className="flex flex-col gap-4">
          <Banner
            tone="success"
            title={preview.data.household_name ? t("join.alreadyMember", { name: preview.data.household_name }) : t("join.alreadyMemberPlain")}
          />
          <Button size="lg" block onClick={() => openHousehold(preview.data?.household_id)}>
            {t("join.open")}
          </Button>
        </div>
      )}
      {preview.data && STATE_TEXT[preview.data.state] && (
        <div className="flex flex-col gap-4">
          <Banner tone="warning" title={t(STATE_TEXT[preview.data.state]!.title)}>
            {t(STATE_TEXT[preview.data.state]!.text)}
          </Banner>
          <Button variant="secondary" size="lg" block onClick={() => navigate("/", { replace: true })}>
            {t("join.continueToApp")}
          </Button>
        </div>
      )}
    </main>
  );
}
