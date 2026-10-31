import { useApp, Back, MeBtn, useState, I, E, IB, Btn, Av, Seg, Toggle } from './ui.jsx';
import { PRODUCTS, PANTRY, MEMBERS } from './data.js';
import { eur0 } from './logic.js';
import { PHOTO_CREDITS } from './credits.js';

/* icons: caret-left caret-right copy users user-plus target sparkle translate arrow-counter-clockwise info check map-trifold */

export function ThemePicker({ value, onPick, big }) {
  const T = [
    ['w', 'Teplá kuchyňa', 'Pokojná a domácka. Krémové farby, elegantné písmo, ilustrácie jedál.'],
    ['g', 'Fotky a sklo', 'Fotky jedál cez celú obrazovku a sklenené panely ako v nových Apple appkách.'],
  ];
  return (
    <div className={'tpick' + (big ? ' big' : '')}>
      {T.map(([k, n, d]) => (
        <button type="button" key={k} className={'tp' + (value === k ? ' on' : '')} onClick={() => onPick(k)} aria-pressed={value === k}>
          <span className={'tprev tp-' + k}>
            {k === 'w' ? <><span className="pw-a">Dobrý večer,<br /><em>Marek</em></span><span className="pw-c"><i /><b /></span><span className="pw-e"><E k="pot" s={26} /></span></>
              : <><span className="pg-p pic-gulas_p" /><span className="pg-c"><i /><b /></span><span className="pg-o" /></>}
          </span>
          <span className="tpt"><b>{n}{value === k && <I n="check-circle" />}</b><small>{d}</small></span>
        </button>
      ))}
    </div>
  );
}

export function More() {
  const { S, act, pop, push, theme, toast, sheet, ai, reset, frame } = useApp();
  const g = theme === 'g';
  const [inv, setInv] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pantry, setPantry] = useState(false);
  const code = 'BH-7K2Q';
  const copy = () => { try { navigator.clipboard.writeText(code).then(() => toast('Kód skopírovaný'), () => toast('Kopírovanie tu nie je povolené – kód si prepíšte', { icon: 'warning-circle' })); } catch { toast('Kopírovanie tu nie je povolené', { icon: 'warning-circle' }); } };
  const pantryAll = [...new Set([...PANTRY, 'mlieko', 'vajcia', 'muka', 'parmezan', 'smotana', 'kecup', 'soja', 'olivy', 'korenie'])];
  return (
    <>
      
      <div className="sc">
        <header className="nb"><Back /><span className="nbt">Viac</span><span className="ibs" /></header>
        <div className="body">
          <div className="lhead"><Av id="m" s={60} /><div className="grow"><h1 className="lt">Marek</h1><div className="meta">Domácnosť Blahovci · 2 členovia</div></div></div>

          <div className="h2 sm">Téma prototypu</div>
          <ThemePicker value={theme} onPick={(t) => { act((s) => ({ ...s, theme: t })); toast(t === 'w' ? 'Téma: Teplá kuchyňa' : 'Téma: Fotky a sklo', { icon: 'paint-brush' }); }} />
          <div className="h2 sm">Vzhľad</div>
          <Seg items={[['light', 'Svetlý'], ['dark', 'Tmavý'], ['system', 'Podľa systému']]} value={S.mode} onChange={(m) => act((s) => ({ ...s, mode: m }))} />

          <div className="h2 sm">Domácnosť</div>
          <div className={'lst' + (g ? ' glass2' : '')}>
            {Object.values(MEMBERS).map((m) => <div className="row" key={m.id}><Av id={m.id} s={40} /><div className="tx"><b>{m.name}</b><span className="sub">{m.id === 'm' ? 'vy · správca' : 'člen · vidí všetky zoznamy'}</span></div></div>)}
            <button type="button" className="row tap" onClick={() => setInv(!inv)}><span className="th ic"><I n="user-plus" /></span><div className="tx"><b>Pozvať do domácnosti</b><span className="sub">kód alebo odkaz</span></div><I n={inv ? 'caret-up' : 'caret-down'} w="bold" cls="chev" /></button>
            {inv && <div className="invite"><span className="code">{code}</span><Btn cls="soft sm" onClick={copy}><I n="copy" />Kopírovať</Btn><p className="meta sm">Druhý človek zadá kód v appke pri registrácii. Kód platí 7 dní.</p></div>}
          </div>

          <div className="h2 sm">Nastavenia</div>
          <div className={'lst menu-l' + (g ? ' glass2' : '')}>
            <button type="button" className="row tap" onClick={() => sheet('budget')}><span className="th ic"><I n="target" /></span><div className="tx"><b>Mesačný rozpočet</b><span className="sub">{eur0(S.budget)}</span></div><I n="caret-right" w="bold" cls="chev" /></button>
            <button type="button" className="row tap" onClick={() => setPantry(!pantry)}><span className="th ic"><I n="house" /></span><div className="tx"><b>Čo mám doma</b><span className="sub">{S.have.length} surovín · recepty s tým počítajú</span></div><I n={pantry ? 'caret-up' : 'caret-down'} w="bold" cls="chev" /></button>
            {pantry && <div className="chips wrap pantry">{pantryAll.filter((x) => PRODUCTS[x]).map((pid) => <button type="button" key={pid} className={'chip' + (S.have.includes(pid) ? ' on' : '')} onClick={() => act('toggleHave', pid)}><E k={PRODUCTS[pid].e} />{PRODUCTS[pid].n.replace(/ ·.*$/, '')}</button>)}</div>}
            <div className="row"><span className="th ic"><I n="sparkle" /></span><div className="tx"><b>AI asistent</b><span className="sub">{ai == null ? 'zisťujem…' : ai ? 'Claude – hlas, recepty, bločky' : 'nedostupný – rozpoznávanie v telefóne'}</span></div><span className={'stat' + (ai ? ' ok' : '')}>{ai ? 'zapnutý' : 'offline'}</span></div>
            <button type="button" className="row tap" onClick={() => push('bookmap')}><span className="th ic"><I n="map-trifold" /></span><div className="tx"><b>Mapa knihy receptov</b><span className="sub">čo máme, čo chýba, čo ľudia hľadajú · pre správcu</span></div><I n="caret-right" w="bold" cls="chev" /></button>
            <div className="row"><span className="th ic"><I n="translate" /></span><div className="tx"><b>Jazyk</b><span className="sub">Slovenčina</span></div></div>
          </div>

          <div className="h2 sm">Prototyp</div>
          <div className={'card' + (g ? ' glass2' : '')}>
            <p className="meta">Toto je klikací prototyp. Zoznamy, nákupy, recepty a bločky sa ukladajú len v tomto prehliadači. Ceny a výdavky sú z testovacej databázy (66 bločkov). Do skutočnej appky sa nič neposiela.</p>
            {confirm ? <div className="sh-act"><Btn cls="soft" onClick={() => setConfirm(false)}>Nie</Btn><Btn cls="danger" onClick={() => { reset(); setConfirm(false); pop(); }}>Áno, začať odznova</Btn></div>
              : <Btn cls="soft full" onClick={() => setConfirm(true)}><I n="arrow-counter-clockwise" w="bold" />Začať ukážku odznova</Btn>}
          </div>
          <details className={'card credits' + (g ? ' glass2' : '')}>
            <summary>Zdroje fotiek jedál</summary>
            <p className="meta">Fotky v receptoch sú z Openverse s voľnou licenciou (CC0 alebo CC BY). Recepty označené „AI recept · test“ majú 3 ilustračné fotky vytvorené AI (Gemini) v jednotnom štýle appky.</p>
            <ul>{PHOTO_CREDITS.map(([t, a, l, u], i) => <li key={i}>{t}{a ? ` – ${a}` : ''} <em>({l})</em></li>)}</ul>
          </details>
        </div>
      </div>
    </>
  );
}
