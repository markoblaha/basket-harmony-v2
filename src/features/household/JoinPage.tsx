import { useNavigate, useParams } from "react-router";
import { Users } from "lucide-react";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, Spinner } from "@/components/ui";
import { useAcceptInvitation, useInvitationPreview } from "./api";
import { rememberHousehold } from "./HouseholdProvider";

const STATE_TEXT: Record<string, { title: string; text: string }> = {
  INVALID: { title: "Pozvánka je neplatná", text: "Skontroluj, či si skopíroval celý odkaz." },
  USED: { title: "Pozvánka už bola použitá", text: "Každá pozvánka platí iba raz. Požiadaj o novú." },
  EXPIRED: { title: "Pozvánka vypršala", text: "Pozvánka platí 7 dní. Požiadaj o novú." },
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      {preview.isPending && <Spinner label="Overujem pozvánku…" />}
      {preview.isError && <Banner tone="danger">{errorMessage(preview.error)}</Banner>}
      {preview.data && preview.data.state === "VALID" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Users className="size-8" aria-hidden />
          </div>
          <div>
            <p className="text-text-2">{preview.data.invited_by ?? "Niekto"} ťa pozýva do domácnosti</p>
            <h1 className="text-2xl font-bold">{preview.data.household_name}</h1>
          </div>
          <p className="text-sm text-text-2">Budete zdieľať nákupný zoznam, nákupy a bločky.</p>
          {accept.isError && <Banner tone="danger">{errorMessage(accept.error)}</Banner>}
          <Button size="lg" block loading={accept.isPending} onClick={join}>
            Pridať sa
          </Button>
          <Button variant="ghost" onClick={() => navigate("/", { replace: true })}>
            Teraz nie
          </Button>
        </div>
      )}
      {preview.data && preview.data.state === "ALREADY_MEMBER" && (
        <div className="flex flex-col gap-4">
          <Banner tone="success" title={`Už si členom domácnosti ${preview.data.household_name ?? ""}`} />
          <Button size="lg" block onClick={() => openHousehold(preview.data?.household_id)}>
            Otvoriť zoznam
          </Button>
        </div>
      )}
      {preview.data && STATE_TEXT[preview.data.state] && (
        <div className="flex flex-col gap-4">
          <Banner tone="warning" title={STATE_TEXT[preview.data.state]!.title}>
            {STATE_TEXT[preview.data.state]!.text}
          </Banner>
          <Button variant="secondary" size="lg" block onClick={() => navigate("/", { replace: true })}>
            Pokračovať do aplikácie
          </Button>
        </div>
      )}
    </main>
  );
}
