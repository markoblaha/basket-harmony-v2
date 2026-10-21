import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, BookOpen, Camera, Check, FileText, Files, Link2, PenLine, Smartphone } from "lucide-react";
import { BottomSheet, SheetHeader } from "@/components/kit";
import { cx } from "@/components/ui";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { errorMessage } from "@/lib/errors";
import { t, tn } from "@/i18n";
import { imageToBase64, readRecipe, useRecipes, type ReadInput, type RecipeDraft } from "./api";
import { saveDraft } from "./cart";
import { Cover } from "./common";

type Source = "photo" | "shot" | "link" | "text";
const SOURCES: { id: Source; icon: typeof Camera }[] = [
  { id: "photo", icon: Camera },
  { id: "shot", icon: Smartphone },
  { id: "link", icon: Link2 },
  { id: "text", icon: FileText },
];
const PHOTO_KINDS = [
  { id: "book", icon: BookOpen },
  { id: "hand", icon: PenLine },
  { id: "pages", icon: Files },
] as const;

export const uncertainCount = (r: RecipeDraft) => r.ingredients.filter((x) => x.uncertain).length + r.steps.filter((x) => x.uncertain).length;

/** R3 – panel: pridať recept z fotky, snímky, odkazu alebo textu. Číta Gemini, človek len skontroluje. */
export function ImportSheet({ open, source: initial, onClose }: { open: boolean; source: "photo" | "link"; onClose: () => void }) {
  const { household } = useHousehold();
  const navigate = useNavigate();
  const recipes = useRecipes(household.id);
  const [source, setSource] = useState<Source>(initial);
  const [kind, setKind] = useState<(typeof PHOTO_KINDS)[number]["id"]>("book");
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"choose" | "reading" | "result">("choose");
  const [pages, setPages] = useState(0);
  const [lit, setLit] = useState(0);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!open) return;
    setSource(initial);
    setPhase("choose");
    setError(null);
    setDraft(null);
  }, [open, initial]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const parts = [
    ...Array.from({ length: pages > 1 ? pages : 0 }, (_, i) => t("rc.read.page", { i: i + 1, n: pages })),
    t("rc.read.name"),
    t("rc.read.portions"),
    t("rc.read.ingredients"),
    t("rc.read.steps"),
  ];

  async function read(input: ReadInput, nPages = 0) {
    setPages(nPages);
    setPhase("reading");
    setError(null);
    setLit(0);
    timers.current.forEach(clearTimeout);
    // Časti sa rozsvecujú postupne; posledná čaká na skutočnú odpoveď.
    const n = (nPages > 1 ? nPages : 0) + 4;
    for (let i = 1; i < n; i++) timers.current.push(setTimeout(() => setLit((x) => Math.max(x, i)), 1600 * i));
    try {
      const r = await readRecipe(input);
      timers.current.forEach(clearTimeout);
      setLit(n);
      setDraft(r);
      saveDraft({ recipe: r, from: input.kind });
      setTimeout(() => setPhase("result"), 350);
    } catch (e) {
      timers.current.forEach(clearTimeout);
      setError(errorMessage(e));
      setPhase("choose");
    }
  }

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, 6);
    if (!files.length) return;
    try {
      const images = await Promise.all(files.map(imageToBase64));
      void read({ kind: "photo", images }, files.length);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const pick = () => {
    if (!file.current) return;
    file.current.value = "";
    file.current.multiple = source === "shot" || kind === "pages";
    if (source === "photo") file.current.setAttribute("capture", "environment");
    else file.current.removeAttribute("capture");
    file.current.click();
  };

  const similar = draft ? recipes.catalog.filter((r) => r.category === draft.category && (r.meat === draft.meat || draft.meat === "bez")).length : 0;

  let body: React.ReactNode;
  if (phase === "reading") {
    body = (
      <>
        <SheetHeader title={t("rc.reading")} sub={t("rc.readingSub")} onClose={onClose} />
        <div className="sheet-body stack g-8">
          {parts.map((p, i) => (
            <div key={p} className={cx("rc-part", lit > i && "on")}>
              {lit > i ? <Check size={18} /> : <span className="spin" style={{ width: 16, height: 16, borderRadius: 99, border: "2px solid currentColor", borderRightColor: "transparent" }} />}
              {p}
            </div>
          ))}
        </div>
      </>
    );
  } else if (phase === "result" && draft) {
    const n = uncertainCount(draft);
    body = (
      <>
        <SheetHeader title={t("rc.readDone")} onClose={onClose} />
        <div className="sheet-body stack g-16">
          <div className="card row g-12" style={{ padding: 10 }}>
            <Cover recipe={{ id: "draft", hue: 30, icon: draft.icon || "CookingPot", mine: true }} size="sm" />
            <span className="grow stack g-2" style={{ minWidth: 0 }}>
              <span className="t-h ellipsis">{draft.name}</span>
              <span className="t-sm t-2">
                {tn("rc.ingredientCount", draft.ingredients.length)} · {tn("rc.stepCount", draft.steps.length)} · {t("rc.minutes", { n: draft.minutes })}
              </span>
            </span>
          </div>
          {n > 0 ? (
            <div className="row g-8 t-sm" style={{ color: "var(--yellow)" }}>
              <AlertTriangle size={17} /> <span className="fw-6">{tn("rc.toCheck", n)}</span> <span className="t-2">{t("rc.markedYellow")}</span>
            </div>
          ) : (
            <div className="row g-8 t-sm t-accent">
              <Check size={17} /> <span className="fw-6">{t("rc.allClear")}</span>
            </div>
          )}
          <div className="stack g-8">
            <button type="button" className="btn btn-ink btn-block" onClick={() => { onClose(); navigate("/recipes/check"); }}>
              {t("rc.saveAsMine")}
            </button>
            {similar > 0 && (
              <button type="button" className="btn btn-line btn-block" onClick={() => { onClose(); navigate("/recipes/search?similar=1"); }}>
                {t("rc.findSimilar", { n: similar })}
              </button>
            )}
          </div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <SheetHeader title={t("rc.addRecipe")} sub={t("rc.addRecipeSub")} onClose={onClose} />
        <div className="sheet-body stack g-12">
          {error && (
            <div className="card row g-8 pad" role="alert" style={{ color: "var(--red)" }}>
              <AlertTriangle size={18} /> <span className="t-sm">{error}</span>
            </div>
          )}
          <div className="cells">
            {SOURCES.map((x) => (
              <button key={x.id} type="button" className="cell" onClick={() => setSource(x.id)} aria-pressed={source === x.id}>
                <span className="cat-ic" style={source === x.id ? { background: "var(--ink)", color: "var(--on-ink)" } : undefined}>
                  <x.icon size={18} />
                </span>
                <span className="grow stack g-2">
                  <span className="t-body fw-6">{t(`rc.src.${x.id}`)}</span>
                  <span className="t-sm t-2">{t(`rc.src.${x.id}Sub`)}</span>
                </span>
                {source === x.id && <Check size={18} />}
              </button>
            ))}
          </div>

          {source === "photo" && (
            <div className="stack g-10 anim-rise">
              <div className="seg">
                {PHOTO_KINDS.map((k) => (
                  <button key={k.id} type="button" className={cx(kind === k.id && "on")} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}>
                    <k.icon size={15} /> {t(`rc.kind.${k.id}`)}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ink btn-block" onClick={pick}>
                <Camera size={18} /> {kind === "pages" ? t("rc.shootPages") : t("rc.shoot")}
              </button>
            </div>
          )}
          {source === "shot" && (
            <button type="button" className="btn btn-ink btn-block anim-rise" onClick={pick}>
              <Smartphone size={18} /> {t("rc.pickShot")}
            </button>
          )}
          {source === "link" && (
            <form className="stack g-8 anim-rise" onSubmit={(e) => { e.preventDefault(); if (link.trim()) void read({ kind: "link", url: link.trim() }); }}>
              <input className="input" inputMode="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} aria-label={t("rc.linkAria")} />
              <button type="submit" className="btn btn-ink btn-block" disabled={!/^https?:\/\/\S+\.\S+/.test(link.trim())}>
                {t("rc.loadLink")}
              </button>
              <span className="t-xs t-3">{t("rc.linkHint")}</span>
            </form>
          )}
          {source === "text" && (
            <form className="stack g-8 anim-rise" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void read({ kind: "text", text: text.trim() }); }}>
              <textarea className="input" style={{ minHeight: 110, padding: 12, resize: "none" }} placeholder={t("rc.pastePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} aria-label={t("rc.textAria")} />
              <button type="submit" className="btn btn-ink btn-block" disabled={text.trim().length < 20}>
                {t("rc.processText")}
              </button>
            </form>
          )}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFiles(e.target.files)} />
        </div>
      </>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} label={t("rc.addRecipe")}>
      {body}
    </BottomSheet>
  );
}
