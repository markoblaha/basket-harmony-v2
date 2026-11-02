/**
 * Domov – zatiaľ prechodná obrazovka (Fáza 1 prestavby): hlavička s avatarom a rozcestník.
 * Skutočný Domov (Treba vybaviť · Nákupy · Naplánované recepty · Rýchlo) príde vo Fáze 2.
 */
import { useNavigate } from "react-router";
import { ChevronRight, CookingPot, ReceiptText, Settings2, ShoppingBasket, Wallet, type LucideIcon } from "lucide-react";
import { MkHeader } from "@/mockup/ui";
import { t, type Key } from "@/i18n";

const LINKS: { to: string; label: Key; sub?: Key; icon: LucideIcon }[] = [
  { to: "/", label: "nav.shopping", icon: ShoppingBasket },
  { to: "/recipes", label: "nav.recipes", icon: CookingPot },
  { to: "/analytics", label: "nav.analytics", icon: Wallet },
  { to: "/receipts", label: "nav.receipts", sub: "home.receiptsSub", icon: ReceiptText },
  { to: "/more", label: "nav.more", sub: "home.moreSub", icon: Settings2 },
];

export function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="stack">
      <MkHeader title={t("nav.home")} />
      <div className="stack g-16 px" style={{ paddingTop: 4 }}>
        <p className="t-body t-2" style={{ padding: "0 4px" }}>
          {t("home.soon")}
        </p>
        <div className="cells">
          {LINKS.map(({ to, label, sub, icon: Icon }) => (
            <button key={to} type="button" className="cell" onClick={() => navigate(to)}>
              <span className="cat-ic" aria-hidden>
                <Icon size={20} />
              </span>
              <span className="grow stack g-2" style={{ textAlign: "left", minWidth: 0 }}>
                <span className="t-title ellipsis">{t(label)}</span>
                {sub && <span className="t-sm t-2 ellipsis">{t(sub)}</span>}
              </span>
              <ChevronRight size={18} className="chev" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
