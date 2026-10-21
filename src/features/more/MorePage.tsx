import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Bell, Check, ChevronRight, CircleHelp, Download, Globe, LogOut, Plus, Repeat, Star, Store, Trash2, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { useSettings, setSetting, type Settings } from "@/lib/settings";
import { shortName } from "@/lib/shortName";
import { BottomSheet, Cell, ConfirmDialog, PersonAvatar, ScreenHeader, Seg, SheetHeader, Stepper, Switch } from "@/components/kit";
import { cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth, useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import {
  useCreateHousehold, useMembers, useMonthlyBudget, useProfiles, useSaveMonthlyBudget, useUpdateDisplayName,
} from "@/features/household/api";
import { useFavoriteTiles } from "@/features/lists/api";
import { useReceipts, type Receipt } from "@/features/receipts/api";
import { formatDateTime, formatEuro, formatNumber, t, tn, type Key } from "@/i18n";
import { LanguagePicker, ThemePicker } from "./AppearancePicker";

/** Prepínače zobrazovania (uložené v zariadení, src/lib/settings.ts). */
const TOGGLES: [keyof Settings & string, Key, Key][] = [
  ["prices", "more.set.prices", "more.set.pricesSub"],
  ["estimate", "more.set.estimate", "more.set.estimateSub"],
  ["homeSection", "more.set.homeSection", "more.set.homeSectionSub"],
  ["nutrition", "more.set.nutrition", "more.set.nutritionSub"],
  ["basketMix", "more.set.basketMix", "more.set.basketMixSub"],
  ["recipeSuggestions", "more.set.recipeSuggestions", "more.set.recipeSuggestionsSub"],
  ["haptics", "more.set.haptics", "more.set.hapticsSub"],
  ["micAutostart", "more.set.micAutostart", "more.set.micAutostartSub"],
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

type SheetName = "profile" | "switch" | "new" | "export" | "help" | null;

/**
 * V1 – Viac: profil, domácnosť, nákupy, zobrazovanie, upozornenia, vzhľad, jazyk a údaje, pomoc, odhlásenie.
 * Prepínače zobrazovania, upozornení a obchodov sú uložené v zariadení; rozpočet a mená v databáze.
 */
export function MorePage() {
  const { user } = useAuth();
  const me = useUserId();
  const navigate = useNavigate();
  const { household, households, select } = useHousehold();
  const toast = useToast();
  const members = useMembers(household.id);
  const profiles = useProfiles();
  const tiles = useFavoriteTiles(household.id);
  const settings = useSettings();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => setSheet(null);

  const myName = profiles.data?.get(me) ?? "";
  const email = user?.email ?? "";
  const shownName = myName || email.split("@")[0] || "";
  const memberCount = members.data?.length ?? 0;
  const isOwner = members.data?.some((m) => m.user_id === me && m.role === "OWNER") ?? false;
  const myTiles = (tiles.data ?? []).filter((x) => x.user_id === me).length;
  const build = formatDateTime(__BUILD_TIME__, { day: "numeric", month: "numeric", year: "numeric" });

  return (
    <div className="stack">
      <ScreenHeader title={t("more.title")} />
      <div className="stack g-20 pad" style={{ paddingTop: 4 }}>
        <button type="button" className="card row" style={{ padding: 16, gap: 14, textAlign: "left" }} onClick={() => setSheet("profile")}>
          <PersonAvatar person={{ id: me, name: shownName }} size="lg" />
          <span className="grow stack g-2">
            <span className="t-title ellipsis">{shownName}</span>
            <span className="t-sm t-2 ellipsis">{email}</span>
            <span className="t-xs t-3">{t("more.profile.edit")}</span>
          </span>
          <ChevronRight size={18} className="chev" />
        </button>

        <Section title={t("more.section.household")}>
          <Cell
            icon={<Ic I={Users} />}
            title={household.name}
            sub={members.data ? `${tn("more.memberCount", memberCount)} · ${isOwner ? t("more.roleOwner") : t("more.roleMember")}` : undefined}
            onClick={() => navigate("/more/household")}
          />
          <Cell
            icon={<Ic I={Repeat} />}
            title={t("more.switchHousehold")}
            sub={households.length > 1 ? t("more.currentHousehold", { name: household.name }) : t("more.onlyOneHousehold")}
            onClick={() => (households.length > 1 ? setSheet("switch") : toast.show(t("more.onlyOneHouseholdToast")))}
          />
          <Cell icon={<Ic I={Plus} />} title={t("more.newHousehold")} onClick={() => setSheet("new")} />
        </Section>

        <Section title={t("more.section.shopping")}>
          <Cell icon={<Ic I={Store} />} title={t("more.stores")} sub={t("more.storesSub")} onClick={() => navigate("/more/stores")} />
          <Cell icon={<Ic I={Star} />} title={t("more.tiles")} sub={t("more.tilesSub", { n: myTiles })} onClick={() => navigate("/more/tiles")} />
          <BudgetRow householdId={household.id} />
        </Section>

        <Section title={t("more.section.display")}>
          {TOGGLES.map(([k, title, sub]) => (
            <div key={k} className="cell">
              <span className="grow stack g-2">
                <span className="t-body fw-5">{t(title)}</span>
                <span className="t-sm t-2">{t(sub)}</span>
              </span>
              <Switch on={!!settings[k]} label={t(title)} onChange={(v) => setSetting(k, v as never)} />
            </div>
          ))}
        </Section>

        <Section title={t("more.section.notifications")}>
          <Cell icon={<Ic I={Bell} />} title={t("more.notifications")} sub={t("more.notificationsSub")} onClick={() => navigate("/more/notifications")} />
        </Section>

        <div className="stack g-8">
          <span className="section-title">{t("more.appearance.title")}</span>
          <ThemePicker />
        </div>

        <Section title={t("more.section.langData")}>
          <div className="cell">
            <Ic I={Globe} />
            <span className="grow t-body fw-5">{t("more.language.label")}</span>
            <LanguagePicker />
          </div>
          <Cell icon={<Ic I={Download} />} title={t("more.export")} sub={t("more.exportSub")} onClick={() => setSheet("export")} />
          <Cell icon={<Ic I={Trash2} tone="red" />} title={t("more.deleteAccount")} danger onClick={() => setConfirmDelete(true)} />
        </Section>

        <Section title={t("more.section.help")}>
          <Cell icon={<Ic I={CircleHelp} />} title={t("more.help")} sub={t("more.helpSub", { date: build })} onClick={() => setSheet("help")} />
        </Section>

        <div className="cells">
          <button type="button" className="cell" onClick={() => supabase.auth.signOut()}>
            <Ic I={LogOut} tone="red" />
            <span className="grow t-body fw-6 t-red">{t("more.signOut")}</span>
          </button>
        </div>
      </div>
      <div className="tab-space" />

      <BottomSheet open={sheet === "profile"} onClose={close} label={t("more.profile.title")}>
        <ProfileSheet current={myName} email={email} onClose={close} />
      </BottomSheet>
      <BottomSheet open={sheet === "switch"} onClose={close} label={t("more.switchHousehold")}>
        <SheetHeader title={t("more.switchHousehold")} onClose={close} />
        <div className="sheet-body">
          <div className="cells">
            {households.map((h) => (
              <Cell
                key={h.id}
                icon={<Ic I={Users} />}
                title={h.name}
                chevron={false}
                right={h.id === household.id ? <Check size={20} className="t-accent" /> : undefined}
                onClick={() => {
                  select(h.id);
                  close();
                  if (h.id !== household.id) toast.show(t("more.switched", { name: h.name }), "success");
                }}
              />
            ))}
          </div>
        </div>
      </BottomSheet>
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
      <BottomSheet open={sheet === "help"} onClose={close} label={t("more.help")}>
        <SheetHeader title={t("more.help")} sub={t("more.helpSub", { date: build })} onClose={close} />
        <div className="sheet-body stack g-10">
          {(["more.help.lists", "more.help.shopping", "more.help.voice", "more.help.receipts", "more.help.recipes"] as const).map((k) => (
            <p key={k} className="card t-sm" style={{ padding: "12px 14px", margin: 0 }}>
              {t(k)}
            </p>
          ))}
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={confirmDelete}
        title={t("more.deleteTitle")}
        body={t("more.deleteBody")}
        confirmLabel={t("common.delete")}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          // Zmazanie účtu potrebuje funkciu na serveri (zatiaľ nie je) – povieme to otvorene.
          toast.show(t("more.deleteUnavailable"));
        }}
      />
    </div>
  );
}

/** Mesačný rozpočet (spoločný pre domácnosť, ten istý ako v Analytike). Ukladá sa chvíľu po poslednom ťuknutí. */
function BudgetRow({ householdId }: { householdId: string }) {
  const budget = useMonthlyBudget(householdId);
  const save = useSaveMonthlyBudget(householdId);
  const toast = useToast();
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = draft ?? budget.data ?? 0;

  const change = (v: number) => {
    setDraft(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      save.mutate(v > 0 ? v : null, {
        onSuccess: () => toast.show(t("more.budgetSaved"), "success"),
        onError: (err) => toast.show(errorMessage(err), "error"),
        onSettled: () => setDraft(null),
      });
    }, 700);
  };

  return (
    <div className="cell">
      <Ic I={Wallet} />
      <span className="grow stack g-2">
        <span className="t-body fw-5">{t("more.budget")}</span>
        <span className="t-sm t-2 num">
          {value > 0 ? t("more.budgetSub", { amount: formatEuro(value).replace(/[,.]00(?=\D*$)/, "") }) : t("more.budgetNone")}
        </span>
      </span>
      <Stepper small value={value} min={0} step={50} onChange={change} />
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
