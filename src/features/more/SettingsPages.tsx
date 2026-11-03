/**
 * Podstránky Viac: Upozornenia a Moje obchody (voľby tohto telefónu, src/lib/settings.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { setSetting, useSettings, type NotifKind } from "@/lib/settings";
import { normalizeName } from "@/lib/categories";
import { haptic } from "@/components/kit";
import { useFlip } from "@/components/motion";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useReceipts } from "@/features/receipts/api";
import { t, tn, type Key } from "@/i18n";
import { Back, I, MkHeader, Toggle } from "@/mockup/ui";
import { Btn, StoreTile, storeKeyOf } from "@/mockup/kit";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { disablePush, enablePush, pushState, syncPushPrefs, type PushState } from "./push";
import { useTheme } from "@/theme/ThemeProvider";

/* ------------------------------------------------------------------ V3 – upozornenia */
const NOTIF: [NotifKind, Key, Key][] = [
  ["start", "more.notif.start", "more.notif.startSub"],
  ["request", "more.notif.request", "more.notif.requestSub"],
  ["reply", "more.notif.reply", "more.notif.replySub"],
  ["unavailable", "more.notif.unavailable", "more.notif.unavailableSub"],
  ["end", "more.notif.end", "more.notif.endSub"],
  ["receiptRead", "more.notif.receiptRead", "more.notif.receiptReadSub"],
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notif } = useSettings();
  const toast = useToast();
  const [push, setPush] = useState<PushState>("unsupported");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushState().then(setPush);
  }, []);
  async function toggle() {
    setBusy(true);
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
      } else {
        const st = await enablePush(notif);
        setPush(st);
        if (st === "on") toast.show(t("push.enabled"), "success");
      }
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }
  const gl = useTheme().style === "glass" ? " glass2" : "";
  return (
    <div className="stack">
      <MkHeader title={t("more.notif.title")} back={<Back label={t("more.title")} onClick={() => navigate("/more")} />}>
        <div className={`card row-card callout${gl}`}>
          <span className="th ic">
            <I n="bell" />
          </span>
          <div className="tx">
            <b>{t("push.title")}</b>
            <span className="sub">{t(`push.state.${push}` as Key)}</span>
          </div>
          {(push === "off" || push === "on") && (
            <Btn cls={push === "on" ? "soft sm" : "pri sm"} onClick={() => void toggle()} disabled={busy}>
              {push === "on" ? t("push.off") : t("push.on")}
            </Btn>
          )}
        </div>
        <div className={`lst${gl}`}>
          {NOTIF.map(([k, title, sub]) => (
            <div key={k} className="row">
              <div className="tx">
                <b>{t(title)}</b>
                <span className="sub">{t(sub)}</span>
              </div>
              <Toggle
                on={notif[k] !== false}
                label={t(title)}
                onChange={(v) => {
                  const next = { ...notif, [k]: v };
                  setSetting("notif", next);
                  // Rovnaké voľby platia aj pre upozornenia do telefónu (na všetkých mojich zariadeniach).
                  if (push === "on") void syncPushPrefs(next).catch(() => undefined);
                }}
              />
            </div>
          ))}
        </div>
        <p className="hint">{t("push.footer")}</p>
      </MkHeader>
      <div className="tab-space" />
    </div>
  );
}

/* ------------------------------------------------------------------ V4 – moje obchody */
const DEFAULT_STORES = ["Lidl", "Kaufland", "Tesco", "Billa", "DM", "Teta"];

export function StoresPage() {
  const navigate = useNavigate();
  const { household } = useHousehold();
  const receipts = useReceipts(household.id);
  const { storeOrder, favStores } = useSettings();

  // Obchody: známe + tie, z ktorých máme doklady; počet dokladov podľa normalizovaného mena.
  const { order, counts } = useMemo(() => {
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const n of DEFAULT_STORES) names.set(normalizeName(n), n);
    for (const r of receipts.data ?? []) {
      if (!r.store_name) continue;
      const k = normalizeName(r.store_name.split(/\s+/)[0] ?? r.store_name);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (!names.has(k)) names.set(k, r.store_name);
    }
    const all = [...names.values()].sort((a, b) => (counts.get(normalizeName(b)) ?? 0) - (counts.get(normalizeName(a)) ?? 0));
    const rank = (n: string) => {
      const i = storeOrder.findIndex((s) => normalizeName(s) === normalizeName(n));
      return i < 0 ? storeOrder.length : i;
    };
    return { order: all.map((n, i) => ({ n, i })).sort((a, b) => rank(a.n) - rank(b.n) || a.i - b.i).map((x) => x.n), counts };
  }, [receipts.data, storeOrder]);

  const isFav = (n: string) => favStores.some((s) => normalizeName(s) === normalizeName(n));
  const toggleFav = (n: string) =>
    setSetting("favStores", isFav(n) ? favStores.filter((s) => normalizeName(s) !== normalizeName(n)) : [...favStores, n]);
  const move = (i: number, d: number) => {
    const o = [...order];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    setSetting("storeOrder", o);
  };

  // Ťahanie za úchyt: riadok ide za prstom, ostatné sa plynulo uhýbajú (FLIP), uloží sa po pustení.
  const box = useRef<HTMLDivElement>(null);
  useFlip(box, { enter: false });
  const [live, setLive] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<{ name: string; dy: number } | null>(null);
  const st = useRef<{ name: string; y0: number; h: number; list: string[] } | null>(null);
  const shown = live ?? order;
  const grab = (e: React.PointerEvent, name: string) => {
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-flip]");
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    st.current = { name, y0: e.clientY, h: row?.offsetHeight || 56, list: [...order] };
    setLive([...order]);
    setDrag({ name, dy: 0 });
    haptic(8);
  };
  const pull = (e: React.PointerEvent) => {
    const c = st.current;
    if (!c) return;
    let dy = e.clientY - c.y0;
    const i = c.list.indexOf(c.name);
    const steps = Math.trunc(dy / c.h + Math.sign(dy) * 0.5);
    const j = Math.max(0, Math.min(c.list.length - 1, i + steps));
    if (j !== i) {
      c.list.splice(i, 1);
      c.list.splice(j, 0, c.name);
      c.y0 += (j - i) * c.h;
      dy = e.clientY - c.y0;
      setLive([...c.list]);
      haptic(6);
    }
    setDrag({ name: c.name, dy });
  };
  const drop = () => {
    const c = st.current;
    st.current = null;
    if (c) setSetting("storeOrder", c.list);
    setDrag(null);
    setLive(null);
  };

  const gl = useTheme().style === "glass" ? " glass2" : "";
  return (
    <div className="stack">
      <MkHeader title={t("more.stores")} back={<Back label={t("more.title")} onClick={() => navigate("/more")} />}>
        <p className="meta">{t("more.stores.help")}</p>
        <div className={`lst${gl}`} ref={box}>
          {shown.map((n, i) => {
            const on = isFav(n);
            const dragging = drag?.name === n;
            return (
              <div
                key={n}
                className="row"
                // Ťahaný riadok riadi prst, plynulé uhýbanie (FLIP) len ostatné.
                data-flip={dragging ? undefined : n}
                style={
                  dragging
                    ? { transform: `translateY(${drag.dy}px) scale(1.02)`, zIndex: 4, background: "var(--card)", boxShadow: "var(--sh)", borderRadius: 16 }
                    : undefined
                }
              >
                <StoreTile k={storeKeyOf(n)} n={n} s={40} />
                <div className="tx">
                  <b>{n}</b>
                  <span className="sub">{tn("more.stores.count", counts.get(normalizeName(n)) ?? 0)}</span>
                </div>
                <button type="button" className={`ib flat sm${on ? " faved" : ""}`} onClick={() => toggleFav(n)} aria-label={on ? t("more.stores.unfav") : t("more.stores.fav")} aria-pressed={on}>
                  <I n="star" />
                </button>
                <button
                  type="button"
                  className="ib flat sm"
                  style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
                  aria-label={t("more.stores.drag", { name: n })}
                  onPointerDown={(e) => grab(e, n)}
                  onPointerMove={pull}
                  onPointerUp={drop}
                  onPointerCancel={drop}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      move(i, e.key === "ArrowUp" ? -1 : 1);
                    }
                  }}
                >
                  <I n="dots-six-vertical" />
                </button>
              </div>
            );
          })}
        </div>
      </MkHeader>
      <div className="tab-space" />
    </div>
  );
}
