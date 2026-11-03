/**
 * Zásady ochrany súkromia (/privacy) a podmienky používania (/terms). Otvoria sa aj bez prihlásenia
 * (odkaz pri registrácii). Texty sú v src/i18n/<jazyk>/legal.ts: odseky oddeľuje prázdny riadok,
 * riadok s „• “ je odrážka.
 */
import { Link, useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { t, type Key } from "@/i18n";

type Doc = "privacy" | "terms";
const SECTIONS: Record<Doc, number> = { privacy: 7, terms: 4 };

function Body({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => {
        const lines = para.split("\n");
        if (lines.every((l) => l.startsWith("• "))) {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1.5 text-text-2">
              {lines.map((l) => (
                <li key={l}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-text-2">
            {para}
          </p>
        );
      })}
    </>
  );
}

export function LegalPage({ doc }: { doc: Doc }) {
  const navigate = useNavigate();
  const other: Doc = doc === "privacy" ? "terms" : "privacy";
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-bg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)] text-text">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="-ml-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-callout font-strong text-accent-text active:bg-pressed"
      >
        <ChevronLeft className="size-5" aria-hidden /> {t("legal.back")}
      </button>
      <h1 className="t-huge mt-4 text-3xl font-semibold">{t(`legal.${doc}.title` as Key)}</h1>
      <p className="mt-1 text-sm text-text-3">{t("legal.updated")}</p>
      <p className="mt-5 text-lg">{t(`legal.${doc}.intro` as Key)}</p>
      <div className="mt-8 flex flex-col gap-7">
        {Array.from({ length: SECTIONS[doc] }, (_, i) => i + 1).map((n) => (
          <section key={n} className="flex flex-col gap-2.5">
            <h2 className="t-big text-xl font-semibold">{t(`legal.${doc}.s${n}.t` as Key)}</h2>
            <Body text={t(`legal.${doc}.s${n}.b` as Key)} />
            {doc === "privacy" && n === 1 && (
              <p className="rounded-[var(--radius-control)] bg-warning-soft px-4 py-3 text-sm text-warning">{t("legal.operator")}</p>
            )}
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-line pt-5 text-sm">
        <Link to={`/${other}`} replace className="font-strong text-accent-text underline underline-offset-4">
          {t(other === "privacy" ? "legal.linkPrivacy" : "legal.linkTerms")}
        </Link>
      </p>
    </main>
  );
}

export function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
export function TermsPage() {
  return <LegalPage doc="terms" />;
}
