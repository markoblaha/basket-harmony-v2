import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Download, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { useSettings, setSetting, type Settings } from "@/lib/settings";
import { shortName } from "@/lib/shortName";
import { BottomSheet, ConfirmDialog, PersonAvatar, Seg, SheetHeader, hapticsSupported } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth, useUserId } from "@/features/auth/AuthProvider";
import { deleteAccount } from "@/features/auth/api";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useCreateHousehold, useCreateInvitation, useMembers, useMonthlyBudget, useProfiles, useUpdateDisplayName } from "@/features/household/api";
import { useOverview } from "@/features/analytics/api";
import { BudgetSheet as MoneyBudgetSheet } from "@/features/analytics/money";
import { computePeriod, thisMonth } from "@/features/analytics/period";
import { useReceipts, type Receipt } from "@/features/receipts/api";
import { formatDateTime, formatNumber, t, tn, type Key } from "@/i18n";
import { LanguagePicker, ThemePicker } from "./AppearancePicker";
import { Back, E, I, MkHeader, Toggle } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { Av, Btn, emojiFor, eur0 } from "@/mockup/kit";
import { PHOTO_CREDITS } from "@/mockup/credits";
import { useTheme } from "@/theme/ThemeProvider";
import { FOODS } from "@/features/recipes/foods";
import { usePantry } from "@/features/recipes/mk";
import { markSeen, signature, useNotifications } from "./notif";
import { HelpBtn, HelpSection } from "@/features/help/Help";
import { setHelp } from "@/features/help/state";

/** Prepínače zobrazovania (uložené v zariadení, src/lib/settings.ts). Hlavné sú vždy vidno, ostatné pod „Rozšírené“. */
type Toggle = [keyof Settings & string, Key, Key];
const MAIN_TOGGLES: Toggle[] = [
  ["prices", "more.set.prices", "more.set.pricesSub"],
  ["estimate", "more.set.estimate", "more.set.estimateSub"],
  ["micAutostart", "more.set.micAutostart", "more.set.micAutostartSub"],
  // Vibrácie len tam, kde ich telefón vie (inak by prepínač nič nerobil).
  ...(hapticsSupported() ? ([["haptics", "more.set.haptics", "more.set.hapticsSub"]] as Toggle[]) : []),
];
const MORE_TOGGLES: Toggle[] = [
  ["homeSection", "more.set.homeSection", "more.set.homeSectionSub"],
  ["recipeSuggestions", "more.set.recipeSuggestions", "more.set.recipeSuggestionsSub"],
  ["nutrition", "more.set.nutrition", "more.set.nutritionSub"],
  ["basketMix", "more.set.basketMix", "more.set.basketMixSub"],
];

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="stack g-8">
      <span className="section-title">{title}</span>
      <div className="cells">{children}</div>
    </div>
  );
}

/** Ikona riadku nastavení (sivý štvorček, pri nebezpečnej akcii červený). */
export function Ic({ I, tone }: { I: LucideIcon; tone?: "red" }) {
  return (
    <span className="cat-ic" style={tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : undefined}>
      <I size={18} strokeWidth={1.9} />
    </span>
  );
}

type SheetName = "profile" | "switch" | "new" | "export" | "help" | "budget" | null;

/** Kandidáti do „Čo mám doma“ (kľúče potravín z receptov). */
const PANTRY_ALL = ["sol", "olej", "korenie", "cukor", "rasca", "paprika_mleta", "muka", "mlieko", "vajce", "maslo", "parmezan", "smotana", "horcica", "olivovy_olej", "ocot", "oregano", "majoran", "kari", "ryza", "cestoviny", "struhanka", "dzem"];

/**
 * Viac – prenesené z mockupu (prototyp/src/more.jsx More): profil a domácnosť, upozornenia, téma a vzhľad,
 * členovia s pozvánkou (odkaz → Poslať), nastavenia (rozpočet, Čo mám doma, obchody, zobrazovanie, upozornenia,
 * jazyk, export), pomoc, odhlásenie a zdroje fotiek. Ostali aj funkcie appky, ktoré mockup nemá
 * (prepnúť/nová domácnosť, export, zmazanie účtu).
 */
export function MorePage() {
  const { user } = useAuth();
  const me = useUserId();
  const navigate = useNavigate();
  const { household, households, select } = useHousehold();
  const toast = useToast();
  const g = useTheme().style === "glass";
  const members = useMembers(household.id);
  const profiles = useProfiles();
  const settings = useSettings();
  const budget = useMonthlyBudget(household.id);
  const overview = useOverview(household.id, useMemo(() => computePeriod("month", thisMonth(), "all", "month"), []));
  const createInvite = useCreateInvitation(household.id);
  const notifs = useNotifications();
  const pantry = usePantry();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [inv, setInv] = useState<{ url: string; expires: string } | null>(null);
  const [invOpen, setInvOpen] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);
  const close = () => setSheet(null);
  // Otvorenie Viac = upozornenia prečítané (bodka na avatare zmizne).
  const sig = signature(notifs);
  useEffect(() => {
    markSeen(sig);
  }, [sig]);
  // Prvé kroky → „Pozvať“ otvorí rovno pozvánku (/more?pozvat=1).
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get("pozvat") !== "1") return;
    setParams({}, { replace: true });
    void invite();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myName = profiles.data?.get(me) ?? "";
  const email = user?.email ?? "";
  const shownName = myName || email.split("@")[0] || "";
  const memberCount = members.data?.length ?? 0;
  const build = formatDateTime(__BUILD_TIME__, { day: "numeric", month: "numeric", year: "numeric" });
  const gl = g ? " glass2" : "";

  const invite = async () => {
    setInvOpen((v) => !v);
    if (inv || invOpen) return;
    try {
      const r = await createInvite.mutateAsync();
      setInv({ url: r.url, expires: r.expires_at });
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  };
  const send = async () => {
    if (!inv) return;
    setHelp(() => ({ invited: true }));
    try {
      if (navigator.share) {
        await navigator.share({ title: t("mo.inviteTitle"), text: t("mo.inviteText", { name: household.name }), url: inv.url });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(inv.url);
      toast.show(t("mo.inviteCopied"), "success");
    } catch {
      toast.show(inv.url);
    }
  };
  const row = (icon: string, title: string, sub: string | undefined, onClick?: () => void, right?: ReactNode) =>
    onClick ? (
      <button type="button" className="row tap" onClick={onClick}>
        <span className="th ic">
          <I n={icon} />
        </span>
        <div className="tx">
          <b>{title}</b>
          {sub && <span className="sub">{sub}</span>}
        </div>
        {right ?? <I n="caret-right" w="bold" cls="chev" />}
      </button>
    ) : (
      <div className="row">
        <span className="th ic">
          <I n={icon} />
        </span>
        <div className="tx">
          <b>{title}</b>
          {sub && <span className="sub">{sub}</span>}
        </div>
        {right}
      </div>
    );

  return (
    <div className="stack">
      <MkHeader title={t("more.title")} back={<Back label={t("common.back")} onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))} />} right={<HelpBtn screen="more" />} style={{ display: "none" }} />
      <div className="bhm bhm-list">
        <div className="body">
          <button type="button" className="lhead" onClick={() => setSheet("profile")} style={{ textAlign: "left" }}>
            <Av id={me} name={shownName} s={60} />
            <div className="grow">
              <h1 className="lt">{shownName}</h1>
              <div className="meta">{memberCount > 1 ? t("mo.household", { name: household.name, n: tn("more.memberCount", memberCount) }) : t("mo.solo")}</div>
            </div>
          </button>

          <div className="h2 sm">{t("mo.notifs")}</div>
          <div className={`lst notifsec${gl}`}>
            {notifs.length ? (
              notifs.map((n) => (
                <button type="button" key={n.id} className="row tap" onClick={() => navigate(n.to)}>
                  {n.av ? (
                    <Av id={n.av.id} name={n.av.name} s={40} />
                  ) : (
                    <span className="th ic">
                      <E k={n.e ?? "basket"} />
                    </span>
                  )}
                  <div className="tx">
                    <b>{n.title}</b>
                    <span className="sub">{n.sub}</span>
                  </div>
                  <I n="caret-right" w="bold" cls="chev" />
                </button>
              ))
            ) : (
              row("check-circle", t("mo.nothing"), t("mo.nothingSub"))
            )}
          </div>

          <div className="h2 sm">{t("more.appearance.theme")}</div>
          <ThemePicker name={shownName} />

          <div className="h2 sm">{t("more.section.household")}</div>
          <div className={`lst${gl}`}>
            {(members.data ?? []).map((m) => (
              <div className="row" key={m.user_id}>
                <Av id={m.user_id} name={m.display_name} s={40} />
                <div className="tx">
                  <b>{m.display_name}</b>
                  <span className="sub">{m.user_id === me ? (m.role === "OWNER" ? t("mo.youOwner") : t("mo.you")) : t("mo.member")}</span>
                </div>
              </div>
            ))}
            <button type="button" className="row tap" onClick={() => void invite()}>
              <span className="th ic">
                <I n="user-plus" />
              </span>
              <div className="tx">
                <b>{t("mo.invite")}</b>
                <span className="sub">{t("mo.inviteSub")}</span>
              </div>
              <I n={invOpen ? "caret-up" : "caret-down"} w="bold" cls="chev" />
            </button>
            {invOpen && (
              <div className="invite">
                <span className="link">{inv ? inv.url.replace(/^https?:\/\//, "") : t("common.loading")}</span>
                <Btn cls={`pri sm${g ? " a" : ""}`} onClick={() => void send()} disabled={!inv}>
                  <I n="paper-plane-right" />
                  {t("mo.send")}
                </Btn>
                <p className="meta sm">{t("mo.inviteHelp", { date: inv ? formatDateTime(inv.expires, { day: "numeric", month: "numeric" }) : "" })}</p>
              </div>
            )}
            {row("users", t("mo.manage"), household.name, () => navigate("/more/household"))}
            {row("arrows-left-right", t("more.switchHousehold"), households.length > 1 ? t("more.currentHousehold", { name: household.name }) : t("more.onlyOneHousehold"), () =>
              households.length > 1 ? setSheet("switch") : toast.show(t("more.onlyOneHouseholdToast")),
            )}
            {row("plus", t("more.newHousehold"), undefined, () => setSheet("new"))}
          </div>

          <HelpSection g={g} />

          <div className="h2 sm">{t("mo.settings")}</div>
          <div className={`lst menu-l${gl}`}>
            {row("target", t("mn.budgetTitle"), budget.data ? eur0(budget.data) : t("more.budgetNone"), () => setSheet("budget"))}
            {row("house", t("mo.pantry"), t("mo.pantrySub", { n: pantry.keys.length }), () => setPantryOpen(!pantryOpen), <I n={pantryOpen ? "caret-up" : "caret-down"} w="bold" cls="chev" />)}
            {pantryOpen && <p className="meta sm pantry-h">{t("mo.pantryHelp")}</p>}
            {pantryOpen && (
              <div className="chips wrap pantry">
                {PANTRY_ALL.filter((k) => FOODS[k]).map((k) => (
                  <button type="button" key={k} className={`chip${pantry.keys.includes(k) ? " on" : ""}`} onClick={() => pantry.toggle(k)}>
                    <E k={emojiFor(FOODS[k]!.name)} />
                    {FOODS[k]!.name}
                  </button>
                ))}
              </div>
            )}
            {row("storefront", t("more.stores"), t("more.storesSub"), () => navigate("/more/stores"))}
            {row("bell", t("more.notifications"), t("more.notificationsSub"), () => navigate("/more/notifications"))}
            {[...MAIN_TOGGLES, ...(advanced ? MORE_TOGGLES : [])].map(([k, title, sub]) => (
              <div className="row" key={k}>
                <div className="tx">
                  <b>{t(title)}</b>
                  <span className="sub">{t(sub)}</span>
                </div>
                <Toggle on={!!settings[k]} label={t(title)} onChange={(v) => setSetting(k, v as never)} />
              </div>
            ))}
            <button type="button" className="row tap" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
              <div className="tx">
                <b>{advanced ? t("more.set.less") : t("more.set.advanced")}</b>
                {!advanced && <span className="sub">{t("more.set.advancedSub")}</span>}
              </div>
              <I n={advanced ? "caret-up" : "caret-down"} w="bold" cls="chev" />
            </button>
            {row("translate", t("more.language.label"), undefined, undefined, <LanguagePicker />)}
            {row("download-simple", t("more.export"), t("more.exportSub"), () => setSheet("export"))}
            {row("question", t("more.help"), t("more.helpSub", { date: build }), () => setSheet("help"))}
            {row("lock-simple", t("legal.moreRow"), t("legal.moreRowSub"), () => navigate("/privacy"))}
          </div>

          <div className={`lst${gl}`}>
            <button type="button" className="row tap" onClick={() => supabase.auth.signOut()}>
              <span className="th ic">
                <I n="sign-out" />
              </span>
              <div className="tx">
                <b className="dng">{t("more.signOut")}</b>
              </div>
            </button>
            <button type="button" className="row tap" onClick={() => setConfirmDelete(true)}>
              <span className="th ic">
                <I n="trash" />
              </span>
              <div className="tx">
                <b className="dng">{t("more.deleteAccount")}</b>
              </div>
            </button>
          </div>

          <details className={`card credits${gl}`}>
            <summary>{t("mo.credits")}</summary>
            <p className="meta">{t("mo.creditsText")}</p>
            <ul>
              {PHOTO_CREDITS.map(([title, author, lic], i) => (
                <li key={i}>
                  {title}
                  {author ? ` – ${author}` : ""} <em>({lic})</em>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <BottomSheet open={sheet === "profile"} onClose={close} label={t("more.profile.title")}>
        <ProfileSheet current={myName} email={email} onClose={close} />
      </BottomSheet>
      <Sheet open={sheet === "switch"} onClose={close} label={t("more.switchHousehold")}>
        <div className="sh-head">
          <h2>{t("more.switchHousehold")}</h2>
        </div>
        <div className="sh-body">
          <div className="menu">
            {households.map((h) => (
              <button
                type="button"
                key={h.id}
                onClick={() => {
                  select(h.id);
                  close();
                  if (h.id !== household.id) toast.show(t("more.switched", { name: h.name }), "success");
                }}
              >
                <I n="users" />
                {h.name}
                {h.id === household.id && <span className="mv">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
      <BottomSheet open={sheet === "new"} onClose={close} label={t("more.newHousehold")}>
        <NewHouseholdSheet
          onClose={close}
          onCreated={(id, name) => {
            select(id);
            close();
            toast.show(t("more.newHouseholdCreated", { name }), "success");
            navigate("/more/household");
          }}
        />
      </BottomSheet>
      <BottomSheet open={sheet === "export"} onClose={close} label={t("more.export")}>
        <ExportSheet householdId={household.id} householdName={household.name} onClose={close} />
      </BottomSheet>
      <Sheet open={sheet === "help"} onClose={close} label={t("more.help")}>
        <div className="sh-head">
          <h2>{t("more.help")}</h2>
        </div>
        <div className="sh-body">
          {(["more.help.lists", "more.help.shopping", "more.help.voice", "more.help.receipts", "more.help.recipes"] as const).map((k) => (
            <p key={k} className="vnote">
              <I n="lightbulb" />
              {t(k)}
            </p>
          ))}
        </div>
      </Sheet>
      <MoneyBudgetSheet
        key={String(budget.data)}
        open={sheet === "budget"}
        onClose={close}
        budget={budget.data ?? null}
        spent={overview.data?.total ?? 0}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t("more.deleteTitle")}
        body={t("more.deleteBody")}
        confirmLabel={t("common.delete")}
        danger
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await deleteAccount();
            // Po odhlásení appka sama prejde na prihlásenie.
            toast.show(t("more.deleted"), "success");
          } catch (err) {
            setDeleting(false);
            setConfirmDelete(false);
            toast.show(errorMessage(err), "error");
          }
        }}
      />
    </div>
  );
}

/** V1P – úprava mena a priezviska (v databáze je jedno meno, skladá sa z oboch polí). */
function ProfileSheet({ current, email, onClose }: { current: string; email: string; onClose: () => void }) {
  const me = useUserId();
  const toast = useToast();
  const update = useUpdateDisplayName(me);
  const parts = current.trim().split(/\s+/);
  const [first, setFirst] = useState(parts[0] ?? "");
  const [last, setLast] = useState(parts.slice(1).join(" "));
  const full = `${first.trim()} ${last.trim()}`.trim();

  async function save() {
    if (!first.trim()) return;
    try {
      if (full !== current) await update.mutateAsync(full);
      onClose();
      toast.show(t("more.profile.savedProfile"), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <>
      <SheetHeader title={t("more.profile.title")} onClose={onClose} />
      <form
        className="sheet-body stack"
        style={{ gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="row g-12">
          <PersonAvatar person={{ id: me, name: full || "?" }} size="lg" />
          <span className="t-sm t-2">
            {t("more.profile.seenAs")} <b style={{ color: "var(--text)" }}>{shortName(full) || "?"}</b>
          </span>
        </div>
        <label className="stack g-6">
          <span className="field-label">{t("more.profile.firstName")}</span>
          <input className="input" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" maxLength={40} />
        </label>
        <label className="stack g-6">
          <span className="field-label">{t("more.profile.lastName")}</span>
          <input className="input" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" maxLength={40} />
        </label>
        <label className="stack g-6">
          <span className="field-label">{t("more.profile.email")}</span>
          <input className="input" value={email} readOnly style={{ color: "var(--text-2)" }} />
        </label>
        <button type="submit" className="btn btn-ink btn-block btn-lg" disabled={!first.trim() || update.isPending}>
          {t("common.save")}
        </button>
      </form>
    </>
  );
}

function NewHouseholdSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, name: string) => void }) {
  const create = useCreateHousehold();
  const toast = useToast();
  const [name, setName] = useState("");
  return (
    <>
      <SheetHeader title={t("more.newHousehold")} onClose={onClose} />
      <form
        className="sheet-body stack"
        style={{ gap: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          try {
            const id = await create.mutateAsync(n);
            onCreated(id, n);
          } catch (err) {
            toast.show(errorMessage(err), "error");
          }
        }}
      >
        <span className="t-sm t-2">{t("more.newHouseholdHelp")}</span>
        <label className="stack g-6">
          <span className="field-label">{t("household.nameLabel")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
        </label>
        <button type="submit" className="btn btn-ink btn-block btn-lg" disabled={!name.trim() || create.isPending}>
          {t("more.newHouseholdCreate")}
        </button>
      </form>
    </>
  );
}

type Period = "month" | "quarter" | "year" | "all";

/** Export dokladov domácnosti do CSV (oddeľovač „;“, aby ho slovenský Excel otvoril v stĺpcoch). */
function ExportSheet({ householdId, householdName, onClose }: { householdId: string; householdName: string; onClose: () => void }) {
  const receipts = useReceipts(householdId);
  const toast = useToast();
  const [period, setPeriod] = useState<Period>("month");
  const from = (() => {
    const d = new Date();
    if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
    if (period === "quarter") return new Date(d.getFullYear(), d.getMonth() - 2, 1);
    if (period === "year") return new Date(d.getFullYear(), 0, 1);
    return null;
  })();
  const fromIso = from ? `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01` : null;
  const rows = (receipts.data ?? []).filter((r) => r.status !== "FAILED" && (!fromIso || (r.purchased_on ?? r.created_at.slice(0, 10)) >= fromIso));

  function download() {
    const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const head = [t("more.export.colDate"), t("more.export.colTime"), t("more.export.colStore"), t("more.export.colTotal"), t("more.export.colStatus"), t("more.export.colSource")];
    const body = rows.map((r: Receipt) =>
      [
        r.purchased_on ?? r.created_at.slice(0, 10),
        r.purchased_time?.slice(0, 5) ?? "",
        r.store_name ?? "",
        r.total == null ? "" : formatNumber(r.total, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
        r.status,
        r.origin ?? "",
      ].map((v) => cell(String(v))).join(";"),
    );
    const csv = "﻿" + [head.join(";"), ...body].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `basket-harmony-${householdName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${period}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.show(t("more.export.done"), "success");
    onClose();
  }

  return (
    <>
      <SheetHeader title={t("more.export")} sub={t("more.exportSub")} onClose={onClose} />
      <div className="sheet-body stack g-16">
        <span className="t-sm t-2">{t("more.export.help")}</span>
        <Seg<Period>
          options={[
            { value: "month", label: t("more.export.month") },
            { value: "quarter", label: t("more.export.quarter") },
            { value: "year", label: t("more.export.year") },
            { value: "all", label: t("more.export.all") },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <span className={cx("t-sm num", rows.length ? "t-2" : "t-3")} style={{ padding: "0 4px" }}>
          {receipts.isPending ? t("common.loading") : rows.length ? tn("more.export.count", rows.length) : t("more.export.empty")}
        </span>
        <button type="button" className="btn btn-ink btn-block btn-lg" disabled={!rows.length} onClick={download}>
          <Download size={18} /> {t("more.export.download")}
        </button>
      </div>
    </>
  );
}
