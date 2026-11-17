/**
 * Uvítanie, ukážka, „?“ a Prvé kroky (mockup prototyp/src/tour.jsx).
 * Ukážka beží v mockupe (/prototyp/?ukazka=…) na vymyslených údajoch – len v prehliadači, do databázy nič
 * nezapíše a nikomu nič nepošle. Appka ju ukáže cez celú plochu a zavrie, keď mockup ohlási koniec.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { t, type Key } from "@/i18n";
import { I } from "@/mockup/ui";
import { Sheet } from "@/mockup/Sheet";
import { useTheme } from "@/theme/ThemeProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useMembers } from "@/features/household/api";
import { useLists } from "@/features/lists/api";
import { useReceipts } from "@/features/receipts/api";
import { BASICS, CHAPTERS, CH_FOR } from "./hints";
import { nbsp } from "./Coach";
import { pushScreen, replayHints, setHelp, setUi, startDemo, useHelp, useHelpUi } from "./state";

const chName = (i: number) => t(`tour.ch${i}` as Key);

/** „?“ v hlavičke: zapíše obrazovku pre nápovedy a otvorí ponuku pomoci. */
export function HelpBtn({ screen, cls = "" }: { screen: string; cls?: string }) {
  useEffect(() => pushScreen(screen), [screen]);
  return (
    <button type="button" className={`ib helpb ${cls}`} onClick={() => setUi({ menu: screen })} aria-label={t("tour.help")}>
      <I n="question" w="bold" />
    </button>
  );
}

/** Ponuka „?“: nápovedy obrazovky · kapitola ukážky · celá ukážka. */
export function HelpMenu() {
  const { menu } = useHelpUi();
  const [last, setLast] = useState("home");
  useEffect(() => {
    if (menu) setLast(menu);
  }, [menu]);
  const screen = menu ?? last;
  const ci = CH_FOR[screen] ?? 0;
  const close = () => setUi({ menu: null });
  const run = (r: string) => {
    close();
    setTimeout(() => startDemo(r), 280);
  };
  return (
    <Sheet open={!!menu} onClose={close} label={t("tour.help")} cls="helpsh">
      <div className="sh-head">
        <div className="grow">
          <h2>{t("tour.helpOn", { screen: t(`tour.scr.${screen.replace("m-", "m_")}` as Key) })}</h2>
          <div className="meta">{t("tour.helpSub")}</div>
        </div>
      </div>
      <div className="sh-body tx-help">
        <button
          type="button"
          className="tx-hrow"
          onClick={() => {
            close();
            setHelp(() => ({ started: true }));
            setTimeout(() => replayHints(screen), 300);
          }}
        >
          <span className="oi">
            <I n="lightbulb" />
          </span>
          <span className="ot">
            <b>{t("tour.hintsHere")}</b>
            <span>{t("tour.hintsHereSub")}</span>
          </span>
          <I n="caret-right" w="bold" cls="chev" />
        </button>
        <button type="button" className="tx-hrow" onClick={() => run(`k${ci}`)}>
          <span className="oi">
            <I n="play" />
          </span>
          <span className="ot">
            <b>{t("tour.chapter", { name: chName(ci) })}</b>
            <span>{t("tour.chapterSub", { time: CHAPTERS[ci]!.time })}</span>
          </span>
          <I n="caret-right" w="bold" cls="chev" />
        </button>
        <button type="button" className="tx-hrow" onClick={() => run("vsetko")}>
          <span className="oi">
            <I n="hand-tap" />
          </span>
          <span className="ot">
            <b>{t("tour.all")}</b>
            <span>{t("tour.allSub")}</span>
          </span>
          <I n="caret-right" w="bold" cls="chev" />
        </button>
      </div>
    </Sheet>
  );
}

/** Ukážka cez celú plochu (mockup v rámčeku). Zavrie sa, keď mockup ohlási koniec. */
export function Demo() {
  const { demo } = useHelpUi();
  const { style, resolved } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!demo) return;
    setReady(false);
    const f = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const d = e.data as { type?: string; ch?: number[] } | null;
      if (d?.type === "bh-demo-ch" && Array.isArray(d.ch)) setHelp((s) => ({ chapters: { ...s.chapters, ...Object.fromEntries(d.ch!.map((x) => [x, true as const])) } }));
      if (d?.type === "bh-demo-end") setUi({ demo: null });
    };
    window.addEventListener("message", f);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("message", f);
      document.body.style.overflow = prev;
    };
  }, [demo]);
  if (!demo) return null;
  const src = `/prototyp/?ukazka=${demo.run}&tema=${style === "glass" ? "g" : "w"}&vzhlad=${resolved}${demo.fromHelp ? "&z=pomoc" : ""}`;
  return (
    <div className="bhm bhm-demo">
      {!ready && (
        <div className="bhm-demo-load" role="status">
          <span className="tx-spin" />
          <span>{t("tour.loading")}</span>
          <button type="button" className="tx-skip" onClick={() => setUi({ demo: null })}>
            {t("common.cancel")}
          </button>
        </div>
      )}
      <iframe title={t("tour.demo")} src={src} onLoad={() => setReady(true)} style={{ opacity: ready ? 1 : 0 }} />
    </div>
  );
}

/** Vitajte – pri prvom spustení v tomto zariadení: ukážka (Základy, asi 2 min) alebo rovno appka s tipmi na Domove. */
export function Welcome() {
  const H = useHelp();
  const { demo } = useHelpUi();
  const navigate = useNavigate();
  const [v, setV] = useState<"main" | "intro">("main");
  if (H.started || demo) return null;
  const startEmpty = () => {
    setHelp(() => ({ started: true, off: true }));
    navigate("/");
    setTimeout(() => replayHints("home"), 400);
  };
  const startTour = () => {
    setHelp(() => ({ started: true, off: true }));
    navigate("/");
    startDemo("zaklady", false);
  };
  if (v === "intro")
    return (
      <div className="bhm bhm-help">
        <div id="tx" className="tx-lay">
          <div className="tx-scrim" />
          <div className="tx-sheet" role="dialog" aria-modal="true" aria-labelledby="tx-it">
            <span className="tx-grab" />
            <h2 className="tx-h2" id="tx-it">
              {t("tour.meet")}
            </h2>
            <div className="tx-fam">
              <div>
                <span className="tx-av m">M</span>
                <span>
                  <b>Marek</b>
                  <small>{t("tour.meetYou")}</small>
                </span>
              </div>
              <div>
                <span className="tx-av l">L</span>
                <span>
                  <b>Lucia</b>
                  <small>{t("tour.meetLucia")}</small>
                </span>
              </div>
            </div>
            <p className="tx-lede">{nbsp(t("tour.meetText"))}</p>
            <div className="tx-chl one">
              {BASICS.map((c, i) => (
                <div key={i}>
                  <span className="n">{i + 1}</span>
                  {t(`tour.b${i}` as Key)} <em>· {c.time}</em>
                </div>
              ))}
            </div>
            <div className="tx-note">
              <I n="lock-simple" />
              <span>{nbsp(t("tour.safe"))}</span>
            </div>
            <button type="button" className="tx-wide p" onClick={startTour} autoFocus>
              <I n="play" />
              {t("tour.startTour")}
            </button>
            <button type="button" className="tx-wide s" onClick={() => setV("main")}>
              {t("common.back")}
            </button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="bhm bhm-help">
      <div id="tx" className="tx-lay">
        <div className="tx-full" role="dialog" aria-modal="true" aria-labelledby="tx-wt">
          <span className="tx-logo">
            <I n="basket" />
          </span>
          <h1 className="tx-h1" id="tx-wt">
            {nbsp(t("tour.welcome"))}
          </h1>
          <p className="tx-lede">{nbsp(t("tour.welcomeText"))}</p>
          <div className="tx-opts">
            <button type="button" className="tx-opt rec" onClick={() => setV("intro")} autoFocus>
              <span className="oi">
                <I n="hand-tap" />
              </span>
              <span className="ot">
                <span className="badge">{t("tour.recommended")}</span>
                <b>{t("tour.optDemo")}</b>
                <span>{nbsp(t("tour.optDemoSub"))}</span>
              </span>
              <I n="caret-right" w="bold" cls="chev" />
            </button>
            <button type="button" className="tx-opt" onClick={startEmpty}>
              <span className="oi">
                <I n="house" />
              </span>
              <span className="ot">
                <b>{t("tour.optEmpty")}</b>
                <span>{nbsp(t("tour.optEmptySub"))}</span>
              </span>
              <I n="caret-right" w="bold" cls="chev" />
            </button>
          </div>
          <p className="tx-foot">{t("tour.later")}</p>
        </div>
      </div>
    </div>
  );
}

/** Viac → Pomoc a ukážka. */
export function HelpSection({ g }: { g: boolean }) {
  const H = useHelp();
  const n = Object.keys(H.chapters).length;
  return (
    <>
      <div className="h2 sm">{t("tour.section")}</div>
      <div className={`lst${g ? " glass2" : ""}`}>
        <button type="button" className="row tap" onClick={() => startDemo("vsetko")}>
          <span className="th ic">
            <I n="hand-tap" />
          </span>
          <div className="tx">
            <b>{t("tour.run")}</b>
            <span className="sub">{n ? t("tour.runDone", { n }) : t("tour.runSub")}</span>
          </div>
          <I n="caret-right" w="bold" cls="chev" />
        </button>
        <div className="tx-chl inl">
          {CHAPTERS.map((_, i) => (
            <button type="button" key={i} onClick={() => startDemo(`k${i}`)}>
              <span className={`n${H.chapters[i] ? " ok" : ""}`}>{H.chapters[i] ? <I n="check" w="bold" /> : i + 1}</span>
              {chName(i)}
            </button>
          ))}
        </div>
        <button type="button" className="row tap" onClick={() => setHelp((s) => ({ off: !s.off, started: true }))} role="switch" aria-checked={!H.off}>
          <span className="th ic">
            <I n="lightbulb" />
          </span>
          <div className="tx">
            <b>{t("tour.hints")}</b>
            <span className="sub">{H.off ? t("tour.hintsOff") : t("tour.hintsOn")}</span>
          </div>
          <span className={`tx-sw${H.off ? "" : " on"}`}>
            <i />
          </span>
        </button>
        <button type="button" className="row tap" onClick={() => setHelp(() => ({ seen: {}, off: false, started: true }))}>
          <span className="th ic">
            <I n="arrow-counter-clockwise" />
          </span>
          <div className="tx">
            <b>{t("tour.again")}</b>
            <span className="sub">{t("tour.againSub")}</span>
          </div>
        </button>
      </div>
    </>
  );
}

/** Prvé kroky na Domove: prvý zoznam, pozvať domácnosť, prvý bloček. Zmizne, keď je všetko hotové alebo „Skryť“. */
export function FirstSteps({ g }: { g: boolean }) {
  const H = useHelp();
  const navigate = useNavigate();
  const { household } = useHousehold();
  const lists = useLists(household.id);
  const members = useMembers(household.id);
  const receipts = useReceipts(household.id);
  if (H.firstHidden || !H.started || lists.isPending || members.isPending || receipts.isPending) return null;
  const st = [
    { k: "list", ok: (lists.data ?? []).length > 0, fn: () => navigate("/lists?novy=1") },
    { k: "inv", ok: H.invited || (members.data ?? []).length > 1, fn: () => navigate("/more?pozvat=1") },
    { k: "rc", ok: (receipts.data ?? []).length > 0, fn: () => navigate("/scan") },
  ];
  const n = st.filter((x) => x.ok).length;
  if (n === st.length) return null;
  const firstOpen = st.findIndex((x) => !x.ok);
  return (
    <section className="hsec" aria-label={t("tour.first")}>
      <div className={`card tx-first${g ? " glass2" : ""}`}>
        <div className="hd">
          <b>{t("tour.first")}</b>
          <span>{t("tour.firstN", { n, all: st.length })}</span>
        </div>
        {st.map((x, i) => (
          <div key={x.k} className={`tx-fs${x.ok ? " ok" : ""}`}>
            <span className="c">{x.ok ? <I n="check" w="bold" /> : i + 1}</span>
            <span className="ot">
              <b>{t(`tour.fs.${x.k}` as Key)}</b>
              <small>{t(`tour.fs.${x.k}Sub` as Key)}</small>
            </span>
            {!x.ok && (
              <button type="button" className={`go${i === firstOpen ? "" : " s"}`} onClick={x.fn}>
                {t(`tour.fs.${x.k}Btn` as Key)}
              </button>
            )}
          </div>
        ))}
        <button type="button" className="tx-hide" onClick={() => setHelp(() => ({ firstHidden: true }))}>
          {t("tour.hide")}
        </button>
      </div>
    </section>
  );
}
