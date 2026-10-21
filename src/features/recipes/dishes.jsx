// Čiarové ilustrácie jedál z prototypu (prenesené bez zmeny kreslenia; typy sú v dishes.d.ts).
// Čiarové ilustrácie jedál (inline SVG, viewBox 0 0 120 90, farba z currentColor).
// Prekrývanie predmetov rieši malý pomocník cut(): čiara „vzadu“ sa preruší tam,
// kde ju zakrýva obrys predmetu „vpredu“ (bez masiek a id, funguje v ľubovoľnom počte kópií).

const K = 0.5523;
const n2 = (v) => Math.round(v * 100) / 100;
const pt = (x, y) => `${n2(x)} ${n2(y)}`;

/* ---------- geometria ---------- */

// elipsa ako 4 kubické krivky (aby ju vedel rozrezať cut)
const E = (cx, cy, rx, ry) =>
  `M${pt(cx - rx, cy)}C${pt(cx - rx, cy - ry * K)} ${pt(cx - rx * K, cy - ry)} ${pt(cx, cy - ry)}` +
  `C${pt(cx + rx * K, cy - ry)} ${pt(cx + rx, cy - ry * K)} ${pt(cx + rx, cy)}` +
  `C${pt(cx + rx, cy + ry * K)} ${pt(cx + rx * K, cy + ry)} ${pt(cx, cy + ry)}` +
  `C${pt(cx - rx * K, cy + ry)} ${pt(cx - rx, cy + ry * K)} ${pt(cx - rx, cy)}Z`;
// polovice elipsy (bez M): horná zľava doprava, dolná zľava doprava, dolná sprava doľava
const upLR = (cx, cy, rx, ry) =>
  `C${pt(cx - rx, cy - ry * K)} ${pt(cx - rx * K, cy - ry)} ${pt(cx, cy - ry)}C${pt(cx + rx * K, cy - ry)} ${pt(cx + rx, cy - ry * K)} ${pt(cx + rx, cy)}`;
const loLR = (cx, cy, rx, ry) =>
  `C${pt(cx - rx, cy + ry * K)} ${pt(cx - rx * K, cy + ry)} ${pt(cx, cy + ry)}C${pt(cx + rx * K, cy + ry)} ${pt(cx + rx, cy + ry * K)} ${pt(cx + rx, cy)}`;
const loRL = (cx, cy, rx, ry) =>
  `C${pt(cx + rx, cy + ry * K)} ${pt(cx + rx * K, cy + ry)} ${pt(cx, cy + ry)}C${pt(cx - rx * K, cy + ry)} ${pt(cx - rx, cy + ry * K)} ${pt(cx - rx, cy)}`;

// oblúk elipsy (uhly v stupňoch, 0 = vpravo, 90 = dole)
function arc(cx, cy, rx, ry, a0, a1) {
  const out = [];
  const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 5));
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    out.push(pt(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  return "M" + out.join("L");
}

function rnd(seed) {
  let s = (seed * 7919) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// uzavretá hladká krivka cez body (Catmull-Rom → Bézier)
function smooth(p, closed = true) {
  const n = p.length;
  const g = (i) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(p[0][0], p[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), q = g(i + 1), p3 = g(i + 2);
    d += `C${pt(p1[0] + (q[0] - p0[0]) / 6, p1[1] + (q[1] - p0[1]) / 6)} ${pt(q[0] - (p3[0] - p1[0]) / 6, q[1] - (p3[1] - p1[1]) / 6)} ${pt(q[0], q[1])}`;
  }
  return closed ? d + "Z" : d;
}

// nepravidelný oblý tvar (kúsok mäsa, halušky, praženica…)
function blob(cx, cy, rx, ry, seed = 1, n = 7, j = 0.22) {
  const r = rnd(seed);
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const k = 1 - j / 2 + r() * j;
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(p);
}

// vlnitá čiara (kapusta, slanina…)
function wave(x0, y0, x1, y1, amp = 1.3, per = 5) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const out = [];
  for (let s = 0; s <= len + 0.01; s += 0.8) {
    const o = Math.sin((s / per) * Math.PI * 2) * amp;
    out.push(pt(x0 + ux * s - uy * o, y0 + uy * s + ux * o));
  }
  return "M" + out.join("L");
}

/* ---------- skrývanie zakrytých čiar ---------- */

function subpaths(d) {
  const t = d.match(/[MLCQZHV]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) || [];
  const res = [];
  let i = 0, cmd = "M", x = 0, y = 0, sx = 0, sy = 0, cur = null;
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/^[a-z]$/i.test(t[i])) cmd = t[i++].toUpperCase();
    if (cmd === "Z") {
      if (cur) cur.closed = true;
      x = sx; y = sy;
      continue;
    }
    if (cmd === "M") {
      x = num(); y = num(); sx = x; sy = y;
      cur = { pts: [[x, y]], closed: false };
      res.push(cur);
      cmd = "L";
    } else if (cmd === "L") {
      x = num(); y = num(); cur.pts.push([x, y]);
    } else if (cmd === "H") {
      x = num(); cur.pts.push([x, y]);
    } else if (cmd === "V") {
      y = num(); cur.pts.push([x, y]);
    } else if (cmd === "C" || cmd === "Q") {
      const c = cmd === "C" ? [num(), num(), num(), num()] : [num(), num()];
      const ex = num(), ey = num();
      for (let s = 1; s <= 12; s++) {
        const u = s / 12, v = 1 - u;
        if (cmd === "C") {
          cur.pts.push([
            v * v * v * x + 3 * v * v * u * c[0] + 3 * v * u * u * c[2] + u * u * u * ex,
            v * v * v * y + 3 * v * v * u * c[1] + 3 * v * u * u * c[3] + u * u * u * ey,
          ]);
        } else {
          cur.pts.push([v * v * x + 2 * v * u * c[0] + u * u * ex, v * v * y + 2 * v * u * c[1] + u * u * ey]);
        }
      }
      x = ex; y = ey;
    } else {
      i++;
    }
  }
  return res;
}

const polyCache = new Map();
function polys(d) {
  let p = polyCache.get(d);
  if (!p) {
    p = subpaths(d).map((s) => s.pts);
    polyCache.set(d, p);
  }
  return p;
}
function inside(x, y, ps) {
  let c = false;
  for (const P of ps) {
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
const flat = (h) => (h ? [].concat(h).flat(Infinity).filter(Boolean) : []);

const cutCache = new Map();
// d bez častí vnútri `hide`; s `keep` ostanú len časti vnútri `keep`
function cut(d, hide, keep) {
  const hs = flat(hide);
  const key = d + "|" + hs.join("|") + "|" + (keep || "");
  if (cutCache.has(key)) return cutCache.get(key);
  const H = hs.map(polys);
  const Kp = keep ? polys(keep) : null;
  let out = "";
  for (const { pts, closed } of subpaths(d)) {
    const P = closed ? [...pts, pts[0]] : pts;
    let seg = [];
    const flush = () => {
      if (seg.length > 1) out += "M" + seg.map((q) => pt(q[0], q[1])).join("L");
      seg = [];
    };
    const test = (q) => {
      if (H.some((h) => inside(q[0], q[1], h))) flush();
      else if (Kp && !inside(q[0], q[1], Kp)) flush();
      else seg.push(q);
    };
    for (let k = 0; k < P.length; k++) {
      if (k > 0) {
        const [ax, ay] = P[k - 1], [bx, by] = P[k];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.45);
        for (let s = 1; s < steps; s++) test([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
      }
      test(P[k]);
    }
    flush();
  }
  cutCache.set(key, out);
  return out;
}

/* ---------- kresliace prvky ---------- */

function L({ d, hide, keep, w, ...p }) {
  const dd = flat(hide).length || keep ? cut(d, hide, keep) : d;
  if (!dd) return null;
  return <path d={dd} strokeWidth={w} {...p} />;
}
const T = ({ d, o = 0.12, rule }) => <path d={d} fill="currentColor" fillOpacity={o} stroke="none" fillRule={rule} />;
const Dots = ({ p, r = 1, o = 0.55 }) => (
  <g fill="currentColor" fillOpacity={o} stroke="none">
    {p.map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={r} />
    ))}
  </g>
);

// plytký tanier
function plate({ cx = 60, cy = 56, rx = 50, ry = 21, hide, f, well = 0.74 }) {
  const fy = cy + ry * 0.8 + 3.2;
  return (
    <>
      <L d={E(cx, cy, rx, ry)} hide={hide} />
      <L d={E(cx, cy + 0.6, rx * well, ry * well)} hide={hide} w={f} />
      <L d={`M${pt(cx - rx * 0.6, fy)}Q${pt(cx, cy + ry * 1.2 + 3.2)} ${pt(cx + rx * 0.6, fy)}`} hide={hide} />
    </>
  );
}

// miska: okraj, telo, nôžka
function bowl({ cx = 60, cy = 42, rx = 40, ry = 12, depth = 28, hide, f, rimHide }) {
  const b = cy + depth;
  const body =
    `M${pt(cx - rx, cy)}C${pt(cx - rx + 1, cy + depth * 0.62)} ${pt(cx - rx * 0.5, b)} ${pt(cx, b)}` +
    `C${pt(cx + rx * 0.5, b)} ${pt(cx + rx - 1, cy + depth * 0.62)} ${pt(cx + rx, cy)}`;
  const foot = `M${pt(cx - rx * 0.33, b - 0.8)}L${pt(cx - rx * 0.36, b + 4.5)}Q${pt(cx, b + 7)} ${pt(cx + rx * 0.36, b + 4.5)}L${pt(cx + rx * 0.33, b - 0.8)}`;
  return (
    <>
      <L d={body} hide={hide} />
      <L d={foot} hide={hide} />
      <L d={E(cx, cy, rx, ry)} hide={[hide, rimHide]} />
      <L d={E(cx, cy + 0.7, rx - 2.8, ry - 2)} hide={[hide, rimHide]} w={f} />
    </>
  );
}
// obrys celej misky (na skrytie čiar za ňou)
const bowlSil = (cx = 60, cy = 42, rx = 40, ry = 12, depth = 28) =>
  `M${pt(cx - rx, cy)}${upLR(cx, cy, rx, ry)}C${pt(cx + rx - 1, cy + depth * 0.62)} ${pt(cx + rx * 0.5, cy + depth + 7)} ${pt(cx, cy + depth + 7)}C${pt(cx - rx * 0.5, cy + depth + 7)} ${pt(cx - rx + 1, cy + depth * 0.62)} ${pt(cx - rx, cy)}Z`;

// valec / plátok ležiaci naplocho (lievanec, mäso, panvica)
function disc(cx, cy, rx, ry, h) {
  return {
    top: E(cx, cy, rx, ry),
    side: `M${pt(cx - rx, cy)}L${pt(cx - rx, cy + h)}${loLR(cx, cy + h, rx, ry)}L${pt(cx + rx, cy)}`,
    sil: `M${pt(cx - rx, cy)}${upLR(cx, cy, rx, ry)}L${pt(cx + rx, cy + h)}${loRL(cx, cy + h, rx, ry)}Z`,
  };
}

// plátok knedle postavený na hranu (líce + hrúbka + póry)
function knedla(x, y, hide, f, rx = 8.5, ry = 7.2) {
  const face = E(x, y, rx, ry);
  const back = E(x + 2.4, y + 1.2, rx, ry);
  return {
    sil: [face, back],
    el: (
      <g key={`k${x}`}>
        <T d={face} o={0.05} />
        <L d={face} hide={hide} />
        <L d={back} hide={[hide, face]} />
        <Dots p={[[x - 3, y - 2.2], [x + 2.5, y - 0.5], [x - 0.8, y + 2.8], [x + 3.6, y + 3.5], [x - 4.5, y + 1.6]].filter(([px, py]) => !flat(hide).some((h) => inside(px, py, polys(h))))} r={0.95} o={0.4} />
      </g>
    ),
  };
}
// rad plátkov knedle, posledný je vpredu
function knedle(list, f, extraHide) {
  const out = [];
  const sils = list.map(([x, y, rx, ry]) => knedla(x, y, null, f, rx, ry).sil);
  list.forEach(([x, y, rx, ry], i) => {
    out.push(knedla(x, y, [sils.slice(i + 1), extraHide], f, rx, ry).el);
  });
  return { el: <>{out}</>, sil: sils };
}

// kocka v izometrii (slanina, zemiak, krutón, feta, paradajka)
function cube(x, y, s, oTop = 0.06, oSide = 0.2, hide) {
  const h = s * 0.95;
  const Tp = [x, y - s * 0.55], R = [x + s, y], B = [x, y + s * 0.55], Lf = [x - s, y];
  const sil = `M${pt(...Lf)}L${pt(...Tp)}L${pt(...R)}L${pt(R[0], R[1] + h)}L${pt(B[0], B[1] + h)}L${pt(Lf[0], Lf[1] + h)}Z`;
  return {
    sil,
    el: (
      <g key={`c${x},${y}`}>
        <T d={`M${pt(...Lf)}L${pt(...B)}L${pt(B[0], B[1] + h)}L${pt(Lf[0], Lf[1] + h)}Z`} o={oSide} />
        <T d={`M${pt(...B)}L${pt(...R)}L${pt(R[0], R[1] + h)}L${pt(B[0], B[1] + h)}Z`} o={oSide * 0.6} />
        <T d={`M${pt(...Lf)}L${pt(...Tp)}L${pt(...R)}L${pt(...B)}Z`} o={oTop} />
        <L d={sil} hide={hide} />
        <L d={`M${pt(...Lf)}L${pt(...B)}L${pt(...R)}M${pt(...B)}L${pt(B[0], B[1] + h)}`} hide={hide} w={s < 4 ? undefined : undefined} />
      </g>
    ),
  };
}

// plátok šampiňónu (prierez)
function shroom(x, y, s, f, hide) {
  const d =
    `M${pt(x - 5 * s, y)}C${pt(x - 5.6 * s, y - 6.6 * s)} ${pt(x + 5.6 * s, y - 6.6 * s)} ${pt(x + 5 * s, y)}` +
    `Q${pt(x + 3.5 * s, y + 1.2 * s)} ${pt(x + 2 * s, y + 0.7 * s)}L${pt(x + 2.4 * s, y + 4.6 * s)}Q${pt(x, y + 5.6 * s)} ${pt(x - 2.4 * s, y + 4.6 * s)}` +
    `L${pt(x - 2 * s, y + 0.7 * s)}Q${pt(x - 3.5 * s, y + 1.2 * s)} ${pt(x - 5 * s, y)}Z`;
  return {
    sil: d,
    el: (
      <g key={`s${x},${y}`}>
        <T d={d} o={0.07} />
        <L d={d} hide={hide} />
        <L d={`M${pt(x - 3.4 * s, y - 0.6 * s)}Q${pt(x, y - 2 * s)} ${pt(x + 3.4 * s, y - 0.6 * s)}`} w={f} hide={hide} />
      </g>
    ),
  };
}

// kyslá uhorka (hrboľatý obrys + bradavičky)
function pickle(cx, cy, a, b, ang, hide) {
  const p = [];
  const ca = Math.cos((ang * Math.PI) / 180), sa = Math.sin((ang * Math.PI) / 180);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const bump = 1 + 0.07 * Math.sin(t * 9);
    const lx = a * Math.sign(c) * Math.abs(c) ** 0.55 * (i % 2 ? 1 : 0.99);
    const ly = b * s * bump * (1 - 0.12 * c);
    p.push([cx + lx * ca - ly * sa, cy + lx * sa + ly * ca]);
  }
  const d = smooth(p);
  const tip = [cx + (a + 2) * ca, cy + (a + 2) * sa];
  const dots = [[-0.55, -0.3], [-0.2, 0.25], [0.15, -0.35], [0.45, 0.2], [0.05, 0.05]].map(([u, v]) => [cx + u * a * ca - v * b * sa, cy + u * a * sa + v * b * ca]);
  return {
    sil: d,
    el: (
      <g key={`p${cx}`}>
        <T d={d} o={0.16} />
        <L d={d} hide={hide} />
        <L d={`M${pt(cx + a * 0.92 * ca, cy + a * 0.92 * sa)}L${pt(...tip)}`} hide={hide} />
        <Dots p={dots} r={0.9} o={0.5} />
      </g>
    ),
  };
}

// kolečko citróna (elipsa so šupkou a dielikmi)
function lemon(x, y, rx, ry, f, hide) {
  const segs = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    segs.push(`M${pt(x + Math.cos(a) * rx * 0.18, y + Math.sin(a) * ry * 0.18)}L${pt(x + Math.cos(a) * (rx - 2.2), y + Math.sin(a) * (ry - 1.9))}`);
  }
  const o = E(x, y, rx, ry);
  return {
    sil: o,
    el: (
      <g key={`l${x}`}>
        <T d={E(x, y, rx - 1.6, ry - 1.4)} o={0.1} />
        <L d={o} hide={hide} />
        <L d={E(x, y, rx - 1.6, ry - 1.4)} w={f} hide={hide} />
        <L d={segs.join("")} w={f} hide={hide} />
      </g>
    ),
  };
}

// obyčajné kolieska (mrkva, párok, uhorka)
function coin(x, y, rx, ry, f, o = 0.14, hide, seeds) {
  const d = E(x, y, rx, ry);
  return {
    sil: d,
    el: (
      <g key={`o${x},${y}`}>
        <T d={d} o={o} />
        <L d={d} hide={hide} />
        <L d={E(x, y, rx * 0.62, ry * 0.62)} w={f} hide={hide} />
        {seeds && <Dots p={[[x - rx * 0.3, y], [x + rx * 0.3, y], [x, y - ry * 0.3], [x, y + ry * 0.3]]} r={0.6} o={0.5} />}
      </g>
    ),
  };
}

// kolienko (zahnutá rúrka)
function elbow(x, y, R, r, a0, a1, f, hide) {
  const rad = (a) => (a * Math.PI) / 180;
  const P = (rr, a) => [x + rr * Math.cos(rad(a)), y + rr * Math.sin(rad(a))];
  const outer = arc(x, y, R, R, a0, a1);
  const inner = arc(x, y, r, r, a1, a0).replace(/^M/, "L");
  const d = outer + inner + "Z";
  const m = P((R + r) / 2, a1);
  const end = E(0, 0, (R - r) / 2, (R - r) / 3.4);
  const ang = a1 + 90;
  return {
    sil: d,
    el: (
      <g key={`e${x},${y}`}>
        <T d={d} o={0.09} />
        <L d={d} hide={hide} />
        <path d={end} transform={`translate(${n2(m[0])} ${n2(m[1])}) rotate(${n2(ang - 90)})`} strokeWidth={f} fill="currentColor" fillOpacity={0.18} />
        <L d={arc(x, y, (R + r) / 2 + 0.2, (R + r) / 2 + 0.2, a0 + 25, a1 - 25)} w={f} hide={hide} />
      </g>
    ),
  };
}

// čučoriedka / brusnica
function berry(x, y, r, o = 0.4, crown = true, f) {
  return (
    <g key={`b${x},${y}`}>
      <circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity={o} />
      {crown && <circle cx={x + r * 0.25} cy={y - r * 0.3} r={r * 0.32} strokeWidth={f * 0.8} />}
    </g>
  );
}

// lístok s hlavnou žilkou
function leaf(x, y, len, wid, ang, f) {
  const d = `M0 0Q${pt(len * 0.4, -wid)} ${pt(len, 0)}Q${pt(len * 0.45, wid)} 0 0Z`;
  return (
    <g key={`f${x},${y}`} transform={`translate(${x} ${y}) rotate(${ang})`}>
      <T d={d} o={0.16} />
      <path d={d} />
      <path d={`M${pt(len * 0.1, 0)}L${pt(len * 0.8, 0)}`} strokeWidth={f} />
    </g>
  );
}

// kopček ryže so zrnkami
function rice(dome, grains, f, hide) {
  return (
    <>
      <T d={dome} o={0.04} />
      <L d={dome} hide={hide} />
      <g strokeWidth={f}>
        {grains.map(([x, y, a], i) => (
          <path key={i} d={`M${pt(x - 1.4 * Math.cos(a), y - 1.4 * Math.sin(a))}L${pt(x + 1.4 * Math.cos(a), y + 1.4 * Math.sin(a))}`} />
        ))}
      </g>
    </>
  );
}

// para nad polievkou
const steam = (x, y, h) =>
  `M${pt(x, y)}C${pt(x - 4, y - h * 0.25)} ${pt(x + 4, y - h * 0.45)} ${pt(x, y - h * 0.65)}C${pt(x - 3, y - h * 0.8)} ${pt(x + 2, y - h * 0.95)} ${pt(x + 0.5, y - h)}`;

// zatočená cibuľka (trochoida)
function curl(x, y, s = 1, flip = 1) {
  const out = [];
  for (let t = 0; t <= Math.PI * 3.2; t += 0.25) out.push(pt(x + (0.85 * t - 2.1 * Math.sin(t)) * s * flip, y - 2.1 * Math.cos(t) * s * 0.7));
  return "M" + out.join("L");
}

/* ---------- jedlá ---------- */

// box = [x0, y0, x1, y1] – skutočný rozsah kresby; zväčší sa a vycentruje do rámu 8 px
// (hrúbka čiary sa prepočíta, aby bola vo všetkých kresbách rovnaká)
const dish = (draw, box = [8, 8, 112, 82]) => {
  const [x0, y0, x1, y1] = box;
  const s = Math.min(102 / (x1 - x0), 72 / (y1 - y0), 1.3);
  const tx = 60 - ((x0 + x1) / 2) * s, ty = 45 - ((y0 + y1) / 2) * s;
  const tr = `translate(${n2(tx)} ${n2(ty)}) scale(${n2(s)})`;
  return function DishSvg({ strokeWidth = 2, ...rest }) {
    const w = strokeWidth / s;
    return (
      <svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
        <g transform={tr} strokeWidth={n2(w)} data-box>
          {draw(n2(w * 0.7), w)}
        </g>
      </svg>
    );
  };
};

export const DISHES = {
  segedin: dish((f) => {
    const kn = knedle([[80, 46], [87, 51.5], [94, 57]], f);
    const dollop = "M31 52C28.5 47.5 33.5 43.5 37.5 45.2C38.5 40.8 45.5 40.5 46.4 44.8C50.5 44.4 52.5 49.8 48.6 52.2Q40 54.6 31 52Z";
    const sauce = E(47, 57, 29, 12.2);
    const meat = [blob(57, 52.5, 5, 3.6, 3), blob(33, 61, 5.5, 3.8, 5), blob(52, 63, 5.2, 3.5, 8), blob(66, 59, 4.4, 3.2, 11)];
    const hide = [dollop, meat];
    return (
      <>
        {plate({ hide: kn.sil, f })}
        <L d={E(60, 58, 27, 10.5)} hide={[kn.sil, sauce]} w={f} />
        <T d={sauce + dollop} o={0.14} rule="evenodd" />
        <L d={sauce} hide={kn.sil} w={f} />
        <g strokeWidth={f}>
          {[[29, 51.5, 60], [24, 56.5, 66], [27, 61.5, 70], [34, 66, 60]].map(([a, y, b], i) => (
            <L key={i} d={wave(a, y, b, y + (i % 2 ? 1 : -1), 1.2, 4.6)} hide={[hide, kn.sil]} w={f} />
          ))}
        </g>
        {meat.map((m, i) => (
          <g key={i}>
            <T d={m} o={0.3} />
            <path d={m} />
          </g>
        ))}
        <T d={dollop} o={0.03} />
        <path d={dollop} />
        <path d="M35.5 48.6Q40 46.2 43.6 48.4" strokeWidth={f} />
        {kn.el}
      </>
    );
  }, [9, 34, 111, 81.2]),

  palacinky: dish((f) => {
    const rolls = [
      [30, 44, 84, 40.5],
      [28, 53, 86, 49.5],
      [30, 62, 88, 58.5],
    ];
    const r = 5.6;
    const sil = ([x1, y1, x2, y2]) =>
      `M${pt(x1, y1 - r)}L${pt(x2, y2 - r)}C${pt(x2 + r * 0.55 * K, y2 - r)} ${pt(x2 + r * 0.55, y2 - r * K)} ${pt(x2 + r * 0.55, y2)}C${pt(x2 + r * 0.55, y2 + r * K)} ${pt(x2 + r * 0.55 * K, y2 + r)} ${pt(x2, y2 + r)}` +
      `L${pt(x1, y1 + r)}C${pt(x1 - r * 0.55 * K, y1 + r)} ${pt(x1 - r * 0.55, y1 + r * K)} ${pt(x1 - r * 0.55, y1)}C${pt(x1 - r * 0.55, y1 - r * K)} ${pt(x1 - r * 0.55 * K, y1 - r)} ${pt(x1, y1 - r)}Z`;
    const sils = rolls.map(sil);
    const spiral = (x, y) => {
      const o = [];
      for (let t = 0; t <= Math.PI * 4.2; t += 0.3) {
        const rr = r * (1 - t / (Math.PI * 4.8));
        o.push(pt(x + rr * 0.5 * Math.cos(t), y - rr * 0.92 * Math.sin(t)));
      }
      return "M" + o.join("L");
    };
    const jam = blob(98, 63, 6.5, 3.6, 4, 8, 0.3);
    return (
      <>
        {plate({ hide: [sils, jam], f })}
        <T d={jam} o={0.35} />
        <path d={jam} />
        {rolls.map((rl, i) => {
          const hide = sils.slice(i + 1);
          const [x1, y1, x2, y2] = rl;
          return (
            <g key={i}>
              <T d={sils[i]} o={0.06} />
              <L d={sils[i]} hide={hide} />
              <L d={E(x2, y2, r * 0.55, r)} hide={hide} w={f} />
              <L d={spiral(x2, y2)} hide={hide} w={f} />
              <L d={`M${pt(x1 + 6, y1 - r * 0.25)}L${pt(x2 - 10, y2 - r * 0.25)}`} hide={hide} w={f} strokeDasharray="0.1 9" />
            </g>
          );
        })}
        <Dots p={[[38, 39.5], [50, 37.2], [63, 36.8], [74, 35.6], [44, 47.2], [58, 45.8], [70, 45], [40, 56.3], [54, 55], [68, 53.8], [78, 52.4], [46, 41], [82, 61], [26, 66]]} r={1} o={0.5} />
      </>
    );
  }, [9, 33.6, 111, 81.2]),

  carbonara: dish((f) => {
    const yolk = E(49, 44.5, 5.6, 4.4);
    const cubes = [cube(31, 60, 3.6, 0.1, 0.32), cube(80, 62, 3.6, 0.1, 0.32), cube(86, 52, 3.4, 0.1, 0.32), cube(44, 66, 3.4, 0.1, 0.32), cube(70, 67, 3.2, 0.1, 0.32)];
    const forkNeck = "M65.5 36.5L61 45.5L68.6 47L69.6 38Z";
    const hide = [yolk, cubes.map((c) => c.sil)];
    const strands = [];
    for (let i = 0; i < 9; i++) {
      const rx = 29 - i * 2.9;
      const ry = rx * 0.42 + 0.8;
      const cy = 57 - (29 - rx) * 0.42;
      const a0 = (i * 67) % 360;
      strands.push(arc(57 + (i % 2 ? 1.2 : -1.2), cy, rx, ry, a0, a0 + 300));
    }
    return (
      <>
        {plate({ hide: [cubes.map((c) => c.sil)], f })}
        <T d={E(57, 55, 28, 12)} o={0.06} />
        {strands.map((d, i) => (
          <L key={i} d={d} hide={[hide, i > 5 ? forkNeck : null]} w={i % 3 === 1 ? f : undefined} />
        ))}
        <path d="M66.4 36.6L88.4 10.6A2.2 2.2 0 0 1 91.8 13.4L69.2 38.2" />
        <path d={forkNeck} fill="currentColor" fillOpacity={0.12} stroke="none" />
        <path d="M65.5 36.5L61 45.5M69.6 38L68.6 47" />
        <path d="M61 45.5L60.4 49M63.6 46L63.2 49.6M66.2 46.5L66 50M68.6 47L68.8 50.4" strokeWidth={f} />
        <T d={yolk} o={0.28} />
        <path d={yolk} />
        <path d="M46.2 42.8Q47.6 41.4 49.4 41.5" strokeWidth={f} />
        {cubes.map((c) => c.el)}
        <Dots p={[[40, 50], [66, 52], [58, 60], [37, 55], [74, 56], [52, 39], [62, 46], [30, 52], [85, 58], [48, 58]]} r={0.95} o={0.45} />
      </>
    );
  }, [9, 8.8, 111, 81.2]),

  stroganov: dish((f) => {
    const dome = "M16.5 60C15.5 48 28 39.5 36 40.5C45 41.5 53 49 52 60C46 66 23 66.5 16.5 60Z";
    const sauce = blob(78, 57, 23, 10.5, 2, 9, 0.12);
    const sh = [shroom(70, 51, 0.82, f), shroom(88, 58.5, 0.82, f), shroom(64, 63, 0.7, f)];
    const shs = sh.map((s) => s.sil);
    const strips = [
      [74, 47, 86, 50],
      [61, 56, 73, 58],
      [78, 59, 82, 66],
      [91, 50, 98, 55],
      [74, 65, 84, 66],
    ].map(([a, b, c, d]) => {
      const len = Math.hypot(c - a, d - b), ux = (c - a) / len, uy = (d - b) / len, w = 2;
      return `M${pt(a - uy * w, b + ux * w)}L${pt(c - uy * w, d + ux * w)}Q${pt(c + ux * 3, d + uy * 3)} ${pt(c + uy * w, d - ux * w)}L${pt(a + uy * w, b - ux * w)}Q${pt(a - ux * 3, b - uy * 3)} ${pt(a - uy * w, b + ux * w)}Z`;
    });
    return (
      <>
        {plate({ hide: [dome], f })}
        <T d={sauce} o={0.15} />
        <L d={sauce} w={f} />
        {strips.map((s, i) => (
          <g key={i}>
            <T d={s} o={0.3} />
            <L d={s} hide={shs} />
          </g>
        ))}
        {sh.map((s) => s.el)}
        {rice(dome, [[24, 52, 0.4], [30, 47, -0.3], [37, 45, 0.2], [44, 49, 0.9], [27, 57, -0.6], [35, 53, 0.1], [42, 56, -0.4], [47, 54, 0.5], [32, 61, 0.3], [40, 61, -0.2], [21, 60, 0.8]], f)}
        {leaf(84, 45, 6, 2.6, -30, f)}
      </>
    );
  }, [9, 34, 111, 81.2]),

  granadir: dish((f) => {
    const B = [50, 44, 36, 11, 26];
    const heap = `M${pt(15, 45)}C${pt(14, 34)} ${pt(30, 23)} ${pt(50, 23)}C${pt(70, 23)} ${pt(86, 34)} ${pt(85, 45)}Z`;
    const pk = pickle(100, 67, 13, 5, -28);
    const items = [
      elbow(30, 41, 6.5, 3, 200, 330, f),
      elbow(52, 33, 6.5, 3, 160, 300, f),
      elbow(68, 41, 6.5, 3, 210, 350, f),
      elbow(44, 46, 6, 2.8, 180, 320, f),
    ];
    const cubes = [cube(40, 34, 4.4, 0.06, 0.2), cube(62, 45, 4.4, 0.06, 0.2), cube(76, 35, 4, 0.06, 0.2), cube(22, 45, 3.8, 0.06, 0.2)];
    const fr = [...items, ...cubes];
    return (
      <>
        {bowl({ cx: B[0], cy: B[1], rx: B[2], ry: B[3], depth: B[4], f, hide: pk.sil, rimHide: heap })}
        <L d={`M${pt(15, 45)}${loLR(50, 45, 35, 9)}`} w={f} hide={[pk.sil]} />
        <T d={heap} o={0.05} />
        <L d={heap.replace(/Z$/, "")} />
        {fr.map((x) => x.el)}
        <g strokeWidth={f}>
          <L d={curl(44, 27, 0.9)} hide={fr.map((x) => x.sil)} />
          <L d={curl(58, 38, 0.9, -1)} hide={fr.map((x) => x.sil)} />
          <L d={curl(28, 33, 0.8)} hide={fr.map((x) => x.sil)} />
          <L d={curl(80, 42, 0.7, -1)} hide={fr.map((x) => x.sil)} />
        </g>
        {pk.el}
      </>
    );
  }, [13, 22, 114.2, 76.8]),

  vepro: dish((f) => {
    // plátok pečene postavený na hranu: oblúk s hrubou kôrkou a zárezmi
    const slice = (x, b, w, h) => {
      const o = `M${pt(x - w / 2, b)}L${pt(x - w / 2, b - h * 0.42)}C${pt(x - w / 2, b - h * 1.12)} ${pt(x + w / 2, b - h * 1.12)} ${pt(x + w / 2, b - h * 0.42)}L${pt(x + w / 2, b)}Q${pt(x, b + 1.6)} ${pt(x - w / 2, b)}Z`;
      const iw = w - 5.4;
      const inner = `M${pt(x - iw / 2, b - h * 0.42)}C${pt(x - iw / 2, b - h * 1.12 + 4.2)} ${pt(x + iw / 2, b - h * 1.12 + 4.2)} ${pt(x + iw / 2, b - h * 0.42)}`;
      const crust = `M${pt(x - w / 2, b - h * 0.42)}C${pt(x - w / 2, b - h * 1.12)} ${pt(x + w / 2, b - h * 1.12)} ${pt(x + w / 2, b - h * 0.42)}L${pt(x + iw / 2, b - h * 0.42)}C${pt(x + iw / 2, b - h * 1.12 + 4.2)} ${pt(x - iw / 2, b - h * 1.12 + 4.2)} ${pt(x - iw / 2, b - h * 0.42)}Z`;
      const bz = (t, p0, p1, p2, p3) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
      const yo = b - h * 0.42, yc = b - h * 1.12, yi = yc + 4.2;
      let ticks = "";
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        const ox = bz(t, x - w / 2, x - w / 2, x + w / 2, x + w / 2), oy = bz(t, yo, yc, yc, yo);
        const ix = bz(t, x - iw / 2, x - iw / 2, x + iw / 2, x + iw / 2), iy = bz(t, yo, yi, yi, yo);
        ticks += `M${pt(ox + (ix - ox) * 0.15, oy + (iy - oy) * 0.15)}L${pt(ox + (ix - ox) * 0.85, oy + (iy - oy) * 0.85)}`;
      }
      const fib = `M${pt(x - w / 2 + 4, b - h * 0.3)}Q${pt(x, b - h * 0.42)} ${pt(x + w / 2 - 4, b - h * 0.3)}M${pt(x - w / 2 + 5, b - h * 0.08)}Q${pt(x, b - h * 0.18)} ${pt(x + w / 2 - 5, b - h * 0.08)}`;
      return { o, inner, crust, ticks, fib };
    };
    const ps = [slice(33, 52, 25, 17), slice(41, 59, 25, 17)];
    const kn = knedle([[57, 61, 8, 6.8], [65, 63.5, 8, 6.8], [73, 66, 8, 6.8]], f);
    const cab = "M71 55C68.5 44 77 37 86.5 37C96 37 104 44.5 101.5 54.5C96 59.5 77 60 71 55Z";
    return (
      <>
        {plate({ hide: [kn.sil, cab, ps.map((q) => q.o)], f })}
        <T d={cab} o={0.1} />
        <L d={cab} hide={kn.sil} />
        <g strokeWidth={f}>
          {[[76, 43, 96], [73, 48, 99], [74, 53, 97]].map(([a, y, b], i) => (
            <L key={i} d={wave(a, y, b, y - 1, 1.1, 4.4)} hide={kn.sil} />
          ))}
        </g>
        <Dots p={[[80, 40.5], [90, 41.5], [84, 51], [95, 48]]} r={0.8} o={0.5} />
        {ps.map((q, i) => {
          const hide = i ? [kn.sil] : [ps[1].o, kn.sil];
          return (
            <g key={i}>
              <T d={q.o} o={0.1} />
              <T d={q.crust} o={0.42} />
              <L d={q.o} hide={hide} />
              <L d={q.inner} hide={hide} w={f} />
              <L d={q.ticks} hide={hide} w={f} />
              <L d={q.fib} hide={hide} w={f} />
            </g>
          );
        })}
        {kn.el}
      </>
    );
  }, [9, 34, 111, 81.2]),

  "kuracie-kari": dish((f) => {
    const B = [58, 42, 42, 13, 28];
    const surf = E(58, 43.5, 39, 10.5);
    const dome = "M22 46C21 37 33 30 42 31C50 32 55 38 54 45C48 50.5 28 51 22 46Z";
    const ch = [blob(68, 41, 5.4, 3.6, 2), blob(81, 45, 5.4, 3.5, 7), blob(66, 49, 5, 3.2, 4), blob(85, 38.5, 4.4, 3, 9)];
    return (
      <>
        {bowl({ cx: B[0], cy: B[1], rx: B[2], ry: B[3], depth: B[4], f })}
        <T d={surf} o={0.16} />
        <L d="M58 37Q66 35 74 37M76 50Q82 51.5 90 48" w={f} />
        {ch.map((c, i) => (
          <g key={i}>
            <T d={c} o={0.28} />
            <path d={c} />
          </g>
        ))}
        {rice(dome, [[28, 42, 0.4], [34, 37, -0.3], [42, 36, 0.2], [48, 40, 0.9], [31, 46, -0.6], [38, 42, 0.1], [45, 45, -0.4], [26, 39, 0.8]], f)}
        {leaf(66, 39, 11, 4.4, -50, f)}
        {leaf(65, 39, 10, 4, -120, f)}
      </>
    );
  }, [15, 28, 101, 76.8]),

  paprikas: dish((f) => {
    const sauce = blob(52, 57, 31, 12, 6, 10, 0.1);
    const meat = "M45 49.5C51 41.5 67 39.5 77 44C89 49 88.5 62 76.5 65C64 68 50 62.5 44.5 56.5C42.8 54.5 43 51.5 45 49.5Z";
    const k1 = E(27, 42.5, 3.4, 3.2), k2 = E(25.2, 48.4, 3.4, 3.2);
    const bone = "M45 50L28.5 43.8M44.5 56L26.8 48.8";
    const nok = [];
    const P = [[86, 59], [94, 59.5], [101, 57], [82, 53.5], [90, 53], [98, 51.5], [86, 48], [94, 47], [90, 42.5]];
    P.forEach(([x, y], i) => nok.push(blob(x, y, 4, 3, i + 2, 6, 0.35)));
    return (
      <>
        {plate({ hide: [nok, k1, k2], f })}
        <T d={sauce} o={0.18} />
        <L d={sauce} w={f} hide={[nok, meat]} />
        {[...nok].reverse().map((d, ri) => {
          const i = nok.length - 1 - ri;
          return (
            <g key={i}>
              <T d={d} o={0.05} />
              <L d={d} hide={nok.slice(0, i).filter((_, k) => P[k][1] > P[i][1] + 1)} />
            </g>
          );
        })}
        <T d={`M45 50L28.5 43.8L26.8 48.8L44.5 56Z`} o={0.04} />
        <L d={bone} hide={[k1, k2, meat]} />
        <L d={k1} hide={k2} />
        <L d={k2} hide={k1} />
        <T d={meat} o={0.26} />
        <path d={meat} />
        <path d="M54 48.5Q64 45 75 48M57 55Q67 53 79 55.5M62 61Q70 61 78 59.5" strokeWidth={f} />
        <Dots p={[[60, 51.5], [70, 51], [80, 51.5], [66, 58], [74, 63]]} r={0.85} o={0.5} />
        <g strokeWidth={f}>
          <circle cx={30} cy={64} r={1.4} />
          <circle cx={58} cy={67} r={1.1} />
          <circle cx={38} cy={67} r={1.5} />
          <circle cx={33} cy={57} r={1} />
        </g>
      </>
    );
  }, [9, 34, 111, 81.2]),

  bryndzove: dish((f) => {
    const PC = [47, 57, 39, 18.5];
    const pb = [];
    for (let i = 0; i < 26; i++) {
      const t = (i / 26) * Math.PI * 2;
      const r = 1 + 0.07 * Math.sin(t * 7) + 0.04 * Math.sin(t * 3 + 1);
      pb.push([47 + Math.cos(t) * 24 * r, 51 + Math.sin(t) * 10 * r]);
    }
    const bry = smooth(pb);
    const drops = [[27, 58], [33, 62.5], [40, 64.8], [48, 65.5], [56, 64.6], [63, 62], [68, 57.6], [24, 53]].map(([x, y], i) => blob(x, y, 3.2, 2.3, i + 3, 6, 0.4));
    const cubes = [cube(38, 48, 3.4, 0.12, 0.38), cube(52, 45, 3.4, 0.12, 0.38), cube(58, 53, 3.2, 0.12, 0.38), cube(44, 55, 3, 0.12, 0.38)];
    const glass = "M92.5 21L94.5 73.5Q102 77 109.5 73.5L111.5 21";
    const liquid = `M${pt(93.1, 34)}${loLR(102, 34, 8.9, 2.6)}L109.5 73.5Q102 77 94.5 73.5Z`;
    return (
      <>
        {plate({ cx: PC[0], cy: PC[1], rx: PC[2], ry: PC[3], f, hide: [bry, drops] })}
        {drops.map((d, i) => (
          <g key={i}>
            <T d={d} o={0.06} />
            <L d={d} hide={[bry]} />
          </g>
        ))}
        <T d={bry} o={0.07} />
        <path d={bry} />
        <L d={wave(32, 50, 60, 49, 0.8, 6)} w={f} hide={cubes.map((c) => c.sil)} />
        {cubes.map((c) => c.el)}
        <g strokeWidth={f}>
          <path d="M30 47L32 45.5M63 47.5L65.5 46.8M47 42L49 41M66 52L68 53" />
        </g>
        <T d={liquid} o={0.1} />
        <path d={glass} />
        <path d={E(102, 21, 9.5, 3)} />
        <path d={arc(102, 34, 8.9, 2.6, 0, 180)} strokeWidth={f} />
        <path d={arc(102, 34, 8.9, 2.6, 180, 360)} strokeWidth={f} strokeOpacity={0.5} />
      </>
    );
  }, [7, 17, 112.5, 79.7]),

  rezen: dish((f) => {
    const p = [];
    for (let i = 0; i < 44; i++) {
      const t = (i / 44) * Math.PI * 2;
      const r = 1 + 0.035 * Math.sin(t * 11) + 0.06 * Math.sin(t * 2 + 0.7);
      p.push([45 + Math.cos(t) * 29 * r, 53 + Math.sin(t) * 12.5 * r - Math.cos(t) * 2]);
    }
    const top = smooth(p);
    const under = smooth(p.map(([x, y]) => [x + 0.6, y + 3]));
    const lem = lemon(50, 49.5, 8, 4.6, f);
    const pot = [blob(93, 47, 7.5, 5, 2, 7, 0.12), blob(84, 58, 7.5, 5, 5, 7, 0.12), blob(98, 59, 6.5, 4.6, 7, 7, 0.12)];
    const crumbs = [];
    const r = rnd(4);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, k = Math.sqrt(r()) * 0.82;
      const x = 45 + Math.cos(a) * 26 * k, y = 53 + Math.sin(a) * 10 * k;
      if (!inside(x, y, polys(lem.sil))) crumbs.push([x, y]);
    }
    return (
      <>
        {plate({ hide: [top, under, pot], f })}
        <T d={top} o={0.14} />
        <L d={under} hide={top} />
        <path d={top} />
        <Dots p={crumbs} r={0.85} o={0.5} />
        {lem.el}
        {pot.map((d, i) => (
          <g key={i}>
            <T d={d} o={0.06} />
            <L d={d} hide={pot.slice(i + 1)} />
          </g>
        ))}
        <Dots p={[[88, 48.5], [96, 46], [80, 59], [87, 60], [95, 61], [101, 58]]} r={0.75} o={0.6} />
      </>
    );
  }, [9, 34, 111, 81.2]),

  "sviečková": dish((f) => {
    const sauce = blob(70, 49, 30, 10.5, 9, 10, 0.1);
    const meat = [disc(56, 45.5, 13, 5.2, 2), disc(70, 47.5, 13, 5.2, 2), disc(84, 49.5, 12, 5, 2)];
    const kn = knedle([[27, 59, 7.5, 6.6], [35, 61.5, 7.5, 6.6], [43, 64, 7.5, 6.6], [51, 66.5, 7.5, 6.6]], f);
    const lem = lemon(80, 62.5, 11.5, 5.2, f);
    const cream = "M72.5 62.5C70.5 60 72 57.4 74.8 57.4C74.4 54.8 76.8 53 79.4 53.6C79.6 51.4 81.6 50.2 82.2 48.6C83.4 50.6 85 52.8 84 54.8C86.6 55.4 87.2 58.4 85.6 59.4C87.4 61 86.2 63.4 83.6 63.9C80 64.8 75.4 64.6 72.5 62.5Z";
    const hideCream = [cream];
    const cr = [[89.6, 61.6], [88.4, 65.4], [92.4, 64.4]];
    return (
      <>
        {plate({ hide: [kn.sil, lem.sil, cr.map(([x, y]) => E(x, y, 2.4, 2.4))], f })}
        <T d={sauce} o={0.2} />
        <L d={sauce} w={f} hide={[kn.sil, lem.sil, cream]} />
        {meat.map((m, i) => {
          const hide = [meat.slice(i + 1).map((x) => x.sil), kn.sil, lem.sil, cream];
          return (
            <g key={i}>
              <T d={m.top} o={0.12} />
              <L d={m.top} hide={hide} />
              <L d={m.side} hide={[hide, m.top]} />
            </g>
          );
        })}
        {lemon(80, 62.5, 11.5, 5.2, f, [hideCream, cr.map(([x, y]) => E(x, y, 2.4, 2.4))]).el}
        <T d={cream} o={0.03} />
        <path d={cream} />
        <path d="M74.8 57.4Q79.5 59.2 85.6 57.6M79.4 53.6Q81.5 54.8 84 54.6" strokeWidth={f} />
        {cr.map(([x, y]) => berry(x, y, 2.4, 0.5, false))}
        {kn.el}
      </>
    );
  }, [9, 34, 111, 81.2]),

  cesnakova: dish((f) => {
    const B = [52, 44, 38, 12, 26];
    const surf = E(52, 45.5, 35, 9.5);
    const garlic = "M101.5 51.5C100.5 56 92 58 91 65.5C90.5 72 95.5 76 101.5 76C107.5 76 112.5 72 112 65.5C111 58 102.5 56 101.5 51.5Z";
    const cr = [cube(40, 43, 3.6, 0.05, 0.22), cube(53, 47.5, 3.6, 0.05, 0.22), cube(64, 42.5, 3.4, 0.05, 0.22), cube(30, 48, 3.2, 0.05, 0.22)];
    return (
      <>
        {bowl({ cx: B[0], cy: B[1], rx: B[2], ry: B[3], depth: B[4], f, hide: garlic })}
        <T d={surf} o={0.12} />
        {cr.map((c) => c.el)}
        <g opacity={0.9}>
          <path d={steam(42, 30, 21)} />
          <path d={steam(54, 28, 20)} />
          <path d={steam(66, 30, 18)} />
        </g>
        <T d={garlic} o={0.06} />
        <path d={garlic} />
        <path d="M101.5 53Q96 60 97.5 75.5M101.5 53Q107 60 105.5 75.5M101.5 53L101.5 76" strokeWidth={f} />
        <path d="M98 76.5L97 79M101.5 76.5V79.2M105 76.5L106 79" strokeWidth={f} />
        <path d="M101.5 51.5L101 48" />
        <Dots p={[[46, 49], [58, 43], [36, 46]]} r={0.8} o={0.5} />
      </>
    );
  }, [13, 7, 113, 80.2]),

  kulajda: dish((f) => {
    const B = [60, 42, 44, 13, 30];
    const surf = E(60, 43.5, 41, 10.5);
    const egg = E(46, 42, 8.5, 5);
    const yolk = E(46.5, 41.6, 3.8, 2.6);
    const sh = [shroom(71, 41, 0.8, f), shroom(60, 48.5, 0.7, f), shroom(31, 46, 0.6, f)];
    const cubes = [cube(78, 47, 3.4, 0.05, 0.18), cube(38, 38.5, 3, 0.05, 0.18), cube(86, 41, 3, 0.05, 0.18)];
    const dill = "M64 39Q74 33 90 34";
    const branches = [];
    [[69, 36.4, -1], [74, 34.6, 1], [79, 34, -1], [84, 33.9, 1]].forEach(([x, y, side]) => {
      const ex = x + 4, ey = y + side * 4.5;
      branches.push(`M${pt(x, y)}L${pt(ex, ey)}`);
      for (const k of [0.45, 0.8]) {
        const bx = x + (ex - x) * k, by = y + (ey - y) * k;
        branches.push(`M${pt(bx, by)}L${pt(bx + 2.4, by - 0.6 * side)}M${pt(bx, by)}L${pt(bx - 0.8, by + 2.4 * side)}`);
      }
      branches.push(`M${pt(ex, ey)}L${pt(ex + 1.6, ey + 1.4 * side)}`);
    });
    branches.push("M90 34L93 32.5M90 34L93 36");
    return (
      <>
        {bowl({ cx: B[0], cy: B[1], rx: B[2], ry: B[3], depth: B[4], f })}
        <T d={surf} o={0.08} />
        {sh.map((s) => s.el)}
        {cubes.map((c) => c.el)}
        <T d={egg} o={0.03} />
        <path d={egg} />
        <T d={yolk} o={0.35} />
        <path d={yolk} strokeWidth={f} />
        <path d={dill} strokeWidth={f} />
        <path d={branches.join("")} strokeWidth={f} />
      </>
    );
  }, [15, 27, 105, 78.8]),

  sosovica: dish((f) => {
    const B = [50, 42, 38, 12, 25];
    const surf = E(50, 43.5, 35, 9.4);
    const coins = [[36, 41], [56, 46], [65, 39.5], [44, 48.5], [27, 46]].map(([x, y]) => disc(x, y, 5.2, 3, 1.8));
    const pk = pickle(100, 66, 13, 5, -26);
    const lent = [];
    const r = rnd(7);
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, k = Math.sqrt(r()) * 0.9;
      const x = 50 + Math.cos(a) * 33 * k, y = 43.5 + Math.sin(a) * 8.6 * k;
      lent.push([x, y]);
    }
    const cs = coins.map((c) => c.sil);
    const ok = [];
    for (const [x, y] of lent) if (!cs.some((c) => inside(x, y, polys(c))) && !ok.some(([u, v]) => Math.hypot(u - x, (v - y) * 1.7) < 3)) ok.push([x, y]);
    return (
      <>
        {bowl({ cx: B[0], cy: B[1], rx: B[2], ry: B[3], depth: B[4], f, hide: pk.sil })}
        <T d={surf} o={0.14} />
        <g fill="currentColor" fillOpacity={0.5} stroke="none">
          {ok.map(([x, y], i) => (
            <ellipse key={i} cx={n2(x)} cy={n2(y)} rx={1.45} ry={0.95} />
          ))}
        </g>
        {coins.map((c, i) => (
          <g key={i}>
            <T d={c.sil} o={0.22} />
            <path d={c.top} />
            <L d={c.side} hide={c.top} />
            <path d={E(...[[36, 41], [56, 46], [65, 39.5], [44, 48.5], [27, 46]][i], 3, 1.6)} strokeWidth={f} />
          </g>
        ))}
        {pk.el}
      </>
    );
  }, [11, 29, 114.5, 75.4]),

  bolonske: dish((f) => {
    const sauce = "M38 53C36 46 42 39.5 50 39C54 35 65 34.5 69 38.5C77 38.5 83 45 81.5 52C77 56 70 54 66 56.5C60 59 54 55.5 49 57C44 58 38.5 56.5 38 53Z";
    const leaves = [leaf(60, 40, 11, 4.4, -55, f), leaf(59, 40, 10, 4, -125, f)];
    const strands = [];
    for (let i = 0; i < 14; i++) {
      const cx = 60 + 11 * Math.sin(i * 2.1), cy = 57 + 3.2 * Math.cos(i * 1.7);
      const rx = 25 - i * 0.9, ry = 9.5 - i * 0.3;
      const a0 = (i * 53) % 360;
      strands.push(arc(cx, cy, rx, ry, a0, a0 + 270));
    }
    const lim = E(60, 57, 38, 15.6);
    return (
      <>
        {plate({ f })}
        {strands.map((d, i) => (
          <L key={i} d={d} hide={[sauce]} keep={lim} w={i % 2 ? f : undefined} />
        ))}
        <T d={sauce} o={0.3} />
        <path d={sauce} />
        <Dots p={[[47, 47], [53, 43], [70, 45], [64, 49], [57, 51], [74, 50], [50, 50]]} r={1.3} o={0.45} />
        {leaves}
      </>
    );
  }, [9, 28.7, 111, 81.2]),

  greckysalat: dish((f) => {
    const B = [58, 47, 45, 12, 22];
    const heap = `M${pt(14, 47)}C${pt(15, 36)} ${pt(32, 27)} ${pt(58, 27)}C${pt(84, 27)} ${pt(101, 36)} ${pt(102, 47)}Z`;
    const feta = cube(58, 33, 8, 0.03, 0.08);
    const tom = [cube(35, 40, 4.4, 0.2, 0.42), cube(80, 46, 4.4, 0.2, 0.42), cube(46, 50, 4.2, 0.2, 0.42)];
    const cuc = [coin(27, 47, 5, 3.6, f, 0.12, null, true), coin(72, 38, 5, 3.6, f, 0.12, null, true), coin(90, 43, 4.6, 3.4, f, 0.12, null, true), coin(62, 49, 4.8, 3.4, f, 0.12, null, true)];
    const olive = (x, y) => (
      <g key={`ol${x}`}>
        <path d={E(x, y, 3, 2.3) + E(x + 0.4, y - 0.3, 1, 0.75)} fill="currentColor" fillOpacity={0.55} fillRule="evenodd" />
      </g>
    );
    const front = [feta.sil, tom.map((t) => t.sil), cuc.map((c) => c.sil)];
    return (
      <>
        {bowl({ cx: B[0], cy: B[1], rx: B[2], ry: B[3], depth: B[4], f, rimHide: heap })}
        <L d={`M${pt(14, 47)}${loLR(58, 47, 44, 9.5)}`} w={f} />
        <T d={heap} o={0.04} />
        <L d={heap.replace(/Z$/, "")} />
        <g strokeWidth={f}>
          <L d={E(42, 32, 6, 2.6)} hide={front} />
          <L d={E(42, 32, 4.2, 1.7)} hide={front} />
          <L d={E(82, 34, 6, 2.6)} hide={front} />
          <L d={E(82, 34, 4.2, 1.7)} hide={front} />
        </g>
        {feta.el}
        <Dots p={[[54, 32.5], [61, 31], [57, 35]]} r={0.6} o={0.35} />
        {tom.map((t) => t.el)}
        {cuc.map((c) => c.el)}
        {olive(30, 38)}
        {olive(70, 46)}
        {olive(86, 38)}
        {olive(52, 43)}
      </>
    );
  }, [12, 26, 104, 75.8]),

  lievance: dish((f) => {
    const st = [disc(58, 56.5, 21, 7.6, 5), disc(61, 50.5, 20, 7.3, 5), disc(57.5, 44.5, 19.5, 7.2, 5)];
    const berries = [[51, 43], [57.5, 41.5], [62, 45], [55, 46.5], [28, 64], [34, 69], [88, 62], [93, 67], [84, 69.5], [24, 58]];
    const syrup = "M70 49C72 49 73 51 72.5 53.5C72.3 55 73.5 56 73 57.5C72.4 59 70.6 58.5 70.6 57C70.6 55.5 70.8 53 69.5 51.5Z";
    return (
      <>
        {plate({ cy: 58, rx: 48, ry: 20, hide: st.map((s) => s.sil), f })}
        {st.map((s, i) => {
          const hide = st.slice(i + 1).map((x) => x.sil);
          return (
            <g key={i}>
              <T d={s.sil} o={0.1} />
              <L d={s.top} hide={hide} />
              <L d={s.side} hide={[hide, s.top]} />
            </g>
          );
        })}
        <T d={E(57.5, 44.5, 19.5, 7.2)} o={0.06} />
        <T d={syrup} o={0.3} />
        <path d={syrup} strokeWidth={f} />
        {berries.map(([x, y]) => berry(x, y, 2.7, 0.42, true, f))}
      </>
    );
  }, [11, 36.3, 109, 82.2]),

  pazenica: dish((f) => {
    const pan = disc(68, 45, 37, 16.5, 5.5);
    const handle = "M101.8 39.5L111.5 30.5A2.6 2.6 0 0 1 115 34.3L104.8 43.2";
    const breadP = (x, y, w, h) =>
      `M${pt(x + 2, y + h)}L${pt(x + 2, y + 9)}C${pt(x - 1.5, y + 8)} ${pt(x - 1.5, y + 0.5)} ${pt(x + 5, y + 0.2)}C${pt(x + 8, y - 1.4)} ${pt(x + w - 8, y - 1.4)} ${pt(x + w - 5, y + 0.2)}C${pt(x + w + 1.5, y + 0.5)} ${pt(x + w + 1.5, y + 8)} ${pt(x + w - 2, y + 9)}L${pt(x + w - 2, y + h)}Z`;
    const b2 = breadP(19, 45, 20, 27);
    const b1 = breadP(8, 51, 20, 27);
    const inner = (x, y, w, h) =>
      `M${pt(x + 4.3, y + h - 2.3)}L${pt(x + 4.3, y + 8)}C${pt(x + 1.6, y + 7)} ${pt(x + 1.8, y + 2.6)} ${pt(x + 6, y + 2.4)}C${pt(x + 8.5, y + 1)} ${pt(x + w - 8.5, y + 1)} ${pt(x + w - 6, y + 2.4)}C${pt(x + w - 1.8, y + 2.6)} ${pt(x + w - 1.6, y + 7)} ${pt(x + w - 4.3, y + 8)}L${pt(x + w - 4.3, y + h - 2.3)}Z`;
    const eggs = [[56, 40, 7, 4], [71, 37, 6.5, 3.6], [85, 42, 6.5, 3.8], [65, 47, 7.5, 4.2], [80, 51, 6.5, 3.8], [52, 50, 5.5, 3.4], [93, 48, 4.6, 3]].map(([x, y, a, b], i) => blob(x, y, a, b, i + 11, 10, 0.42));
    return (
      <>
        <T d={pan.sil} o={0.05} />
        <L d={pan.top} hide={[b1, b2]} />
        <L d={E(68, 45.6, 33.5, 14)} hide={[b1, b2]} w={f} />
        <L d={pan.side} hide={[b1, b2, pan.top]} />
        <path d={handle} />
        <circle cx={112.3} cy={32.8} r={0.9} strokeWidth={f} />
        {eggs.map((d, i) => (
          <g key={i}>
            <T d={d} o={i % 2 ? 0.2 : 0.1} />
            <L d={d} hide={eggs.slice(i + 1)} />
          </g>
        ))}
        <g strokeWidth={f}>
          <path d="M60 44L62 43M74 43.5L76.5 44M88 46L89.5 47.5M70 53L72 52.2M59 53.5L61 54M79 39.5L81 39" />
        </g>
        <T d={b2} o={0.08} />
        <L d={b2} hide={b1} />
        <L d={inner(19, 45, 20, 27)} hide={b1} w={f} />
        <T d={b1} o={0.08} />
        <path d={b1} />
        <path d={inner(8, 51, 20, 27)} strokeWidth={f} />
        <Dots p={[[14, 62], [21, 66], [16, 71], [22, 59]]} r={0.7} o={0.45} />
      </>
    );
  }, [6.7, 27.5, 116.6, 79]),

  buchty: dish((f) => {
    const bun = (x, base, w, h) =>
      `M${pt(x - w / 2, base)}C${pt(x - w / 2 - 1.5, base - h * 0.75)} ${pt(x - w * 0.3, base - h)} ${pt(x, base - h)}C${pt(x + w * 0.3, base - h)} ${pt(x + w / 2 + 1.5, base - h * 0.75)} ${pt(x + w / 2, base)}Z`;
    const back = [bun(36, 49, 23, 17), bun(59, 49, 23, 17.5), bun(82, 49, 23, 17)];
    const front = [bun(31, 66, 26, 19), bun(58, 66, 26, 20), bun(85, 66, 26, 19)];
    const tray = "M23 34L97 34L109 70L11 70Z";
    const jam = "M69.5 52C72 56 68.5 60 69.5 64C67.5 67 66 70 69 71.5C72.5 73 78.5 72 77.5 69C76.5 66.5 74 65 74.5 61C75 57 74 54 72 51.5Z";
    return (
      <>
        <T d={tray} o={0.06} />
        <L d={tray} hide={[front, back]} />
        <L d="M26.3 37L93.7 37L104.6 67.6L15.4 67.6Z" hide={[front, back]} w={f} />
        <path d="M11 70L11.6 75L108.4 75L109 70" />
        {back.map((d, i) => (
          <g key={i}>
            <T d={d} o={0.12} />
            <L d={d} hide={[front, back.slice(i + 1)]} />
          </g>
        ))}
        {front.map((d, i) => (
          <g key={i}>
            <T d={d} o={0.1} />
            <L d={d} hide={[front.slice(i + 1), jam]} />
          </g>
        ))}
        <L d="M23 53Q25 48 29 46.5M50 53Q52 48 56 46.5M77 53Q79 48 83 46.5" w={f} />
        <T d={jam} o={0.42} />
        <path d={jam} />
        <Dots p={[[30, 37], [37, 34.5], [44, 37.5], [55, 36], [61, 33], [67, 36.6], [78, 35], [85, 33.5], [90, 37.5], [26, 53], [33, 50], [39, 54.5], [52, 52], [59, 48.5], [66, 52], [79, 52], [86, 49.5], [93, 53.5]]} r={1} o={0.5} />
      </>
    );
  }, [10, 30.5, 110, 76]),

  losos: dish((f) => {
    const top = "M24 51C24 46.5 27 45 31 44.8L62 43C66.5 42.8 69 45 68.8 49L68 57C67.8 60.5 65.5 62 62 62.2L30.5 63.5C26.5 63.6 24 61.5 24 58Z";
    const sideD = "M24 58L24 61.4C24 65 26.5 67 30.5 66.9L62 65.6C65.5 65.4 67.8 64 68 60.5L68 57";
    const grill = [];
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 9;
      grill.push(`M${pt(x, 44)}L${pt(x + 7, 64)}`);
    }
    const stripes = [];
    for (let i = 0; i < 6; i++) {
      const x = 28 + i * 7.4;
      stripes.push(`M${pt(x + 6, 44)}Q${pt(x - 2, 53)} ${pt(x + 3, 63.5)}`);
    }
    const bp = [];
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      const r = 1 + 0.1 * Math.cos(t * 7);
      bp.push([88 + Math.cos(t) * 11 * r, 40 + Math.sin(t) * 7.5 * r]);
    }
    const broc = smooth(bp);
    const stem = "M84 46L85 55.5Q88.5 57.5 92 55.5L93 46";
    const car = [coin(78, 62, 5, 3.2, f, 0.22), coin(90, 64, 5, 3.2, f, 0.22), coin(101, 57, 4.5, 3, f, 0.22)];
    const lem = "M41 72C41 66 47 63.5 52 63.5C57 63.5 63 66 63 72Z";
    return (
      <>
        {plate({ hide: [car.map((c) => c.sil), lem], f })}
        <T d={top} o={0.16} />
        <L d={sideD} hide={[lem]} />
        <T d={sideD + "L24 58Z"} o={0.24} />
        <path d={top} />
        <L d={grill.join("")} keep={top} />
        <L d={stripes.join("")} keep={top} w={f} strokeOpacity={0.6} />
        <T d={broc} o={0.18} />
        <path d={broc} />
        <path d="M81 41Q84 38.5 87 41M88 38Q91 35.5 94 38.5M85 45Q88 43 91 45.5" strokeWidth={f} />
        <L d={stem} hide={broc} />
        <L d="M88.5 47V54" hide={broc} w={f} />
        {car.map((c) => c.el)}
        <T d={lem} o={0.1} />
        <path d={lem} />
        <path d="M44 70.6C44 67.5 48 66 52 66C56 66 60 67.5 60 70.6Z" strokeWidth={f} />
        <path d="M52 70.6V66.3M52 70.6L46.5 67.5M52 70.6L57.5 67.5" strokeWidth={f} />
      </>
    );
  }, [9, 30.9, 111, 81.2]),
};

export function Dish({ id, size = 84, strokeWidth = 2 }) {
  const C = DISHES[id];
  if (!C) return null;
  return <C width={n2((size * 120) / 90)} height={size} strokeWidth={strokeWidth} />;
}
