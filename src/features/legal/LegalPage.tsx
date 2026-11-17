/**
 * Zásady ochrany súkromia (/privacy) a podmienky používania (/terms). Otvoria sa aj bez prihlásenia
 * (odkaz pri registrácii). Texty sú v src/i18n/<jazyk>/legal.ts: odseky oddeľuje prázdny riadok,
 * riadok s „• “ je odrážka.
 */
import { Link, useNavigate } from "react-router";
import { I } from "@/mockup/ui";
import { AuthShell, Note } from "@/features/auth/shell";
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
            <ul key={i} className="legal-ul">
              {lines.map((l) => (
                <li key={l}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="legal-p">
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
    <AuthShell wide>
      <button type="button" className="back legal-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
        <I n="caret-left" w="bold" />
        <span>{t("legal.back")}</span>
      </button>
      <h1 className="lt">{t(`legal.${doc}.title` as Key)}</h1>
      <p className="meta sm">{t("legal.updated")}</p>
      <p className="legal-intro">{t(`legal.${doc}.intro` as Key)}</p>
      {Array.from({ length: SECTIONS[doc] }, (_, i) => i + 1).map((n) => (
        <section key={n} className="legal-sec">
          <h2 className="h2">{t(`legal.${doc}.s${n}.t` as Key)}</h2>
          <Body text={t(`legal.${doc}.s${n}.b` as Key)} />
          {doc === "privacy" && n === 1 && <Note tone="warn">{t("legal.operator")}</Note>}
        </section>
      ))}
      <Link to={`/${other}`} replace className="lnk">
        {t(other === "privacy" ? "legal.linkPrivacy" : "legal.linkTerms")}
      </Link>
    </AuthShell>
  );
}

export function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
export function TermsPage() {
  return <LegalPage doc="terms" />;
}
