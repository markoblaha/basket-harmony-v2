/**
 * Nápovedy po obrazovkách (mockup prototyp/src/coach.jsx). Texty sú v slovníku pod `co.<id>.t` / `co.<id>.x`.
 * screen = obrazovka s „?“; sel = prvok, na ktorý ukazuje (musí byť naozaj na obrazovke).
 * global = hľadá sa v celej appke (spodná lišta), modal = v okne na celú plochu (nákup, hlas, varenie…).
 * hand = ťuknutím na zvýraznený prvok sa rovno použije.
 */
export type Hint = { id: string; screen: string; sel: string; global?: boolean; modal?: boolean; hand?: boolean };

export const HINTS: Hint[] = [
  { id: "mic", screen: "home", sel: ".tabbar .tmic", global: true, hand: true },
  { id: "tabs", screen: "home", sel: ".tabbar", global: true },
  { id: "quick", screen: "home", sel: ".hqa" },
  { id: "help", screen: "home", sel: ".nb .helpb" },
  { id: "lcard", screen: "lists", sel: ".lcard" },
  { id: "lgo", screen: "lists", sel: ".lgo", hand: true },
  { id: "newlist", screen: "lists", sel: ".nb .addb", hand: true },
  { id: "hist", screen: "lists", sel: ".histrow" },
  { id: "swipe", screen: "list", sel: ".lst .row" },
  { id: "composer", screen: "list", sel: ".dock .field" },
  { id: "shopbtn", screen: "list", sel: ".est .btn", hand: true },
  { id: "shrow", screen: "m-shop", sel: ".lst.big .row", modal: true, hand: true },
  { id: "shhead", screen: "m-shop", sel: ".shopnb .snb-seg", modal: true },
  { id: "shdone", screen: "m-shop", sel: ".tgl-g", modal: true },
  { id: "flive", screen: "m-follow", sel: ".lst", modal: true },
  { id: "fask", screen: "m-follow", sel: ".dock .field", modal: true },
  { id: "cstep", screen: "m-cook", sel: ".stx", modal: true },
  { id: "ttimer", screen: "m-cook", sel: ".cbox", modal: true },
  { id: "tfeed", screen: "m-taste", sel: ".tst-feed", modal: true },
  { id: "tlike", screen: "m-taste", sel: ".tr-b", modal: true, hand: true },
  { id: "vtarget", screen: "m-voice", sel: ".vx-target", modal: true },
  { id: "vorb", screen: "m-voice", sel: ".vx-orb", modal: true },
  { id: "vdone", screen: "m-voice", sel: ".vx-done", modal: true },
  { id: "taste", screen: "recipes", sel: ".tentry", hand: true },
  { id: "rsearch", screen: "recipes", sel: ".search" },
  { id: "rtabs", screen: "recipes", sel: ".seg" },
  { id: "recadd", screen: "recipe", sel: ".dock .dockc .btn" },
  { id: "ing", screen: "recipe", sel: '.ings .ing[role="button"]', hand: true },
  { id: "mper", screen: "money", sel: ".seg" },
  { id: "minsight", screen: "money", sel: ".card.insight" },
  { id: "mrc", screen: "money", sel: ".mrc" },
  { id: "scan", screen: "money", sel: ".rbtns .btn.pri", hand: true },
  { id: "mnotif", screen: "more", sel: ".notifsec" },
  { id: "mhelp", screen: "more", sel: ".tx-chl.inl" },
  { id: "hrow", screen: "history", sel: ".lst .row" },
];

/** Kapitola ukážky, ktorú „?“ ponúkne na danej obrazovke (index v CHAPTERS). */
export const CH_FOR: Record<string, number> = {
  home: 0, lists: 1, list: 1, history: 3, recipes: 5, recipe: 5, money: 6, more: 7,
  "m-shop": 3, "m-follow": 0, "m-voice": 2, "m-cook": 5, "m-taste": 5,
};

/** Kapitoly ukážky (názvy v slovníku `tour.ch<i>`, ikony z mockupu). Samotná ukážka beží v mockupe. */
export const CHAPTERS: { ic: string; time: string }[] = [
  { ic: "house", time: "30 s" },
  { ic: "note-pencil", time: "50 s" },
  { ic: "microphone", time: "30 s" },
  { ic: "basket", time: "40 s" },
  { ic: "receipt", time: "30 s" },
  { ic: "cooking-pot", time: "40 s" },
  { ic: "wallet", time: "30 s" },
  { ic: "user-plus", time: "20 s" },
];
/** Základy pri prvom spustení: 3 kapitoly, asi 2 minúty. */
export const BASICS: { time: string }[] = [{ time: "30 s" }, { time: "50 s" }, { time: "40 s" }];
