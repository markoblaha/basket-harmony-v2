// Upozornenia do telefónu (Web Push). Volá ju len databáza (spúšťače, _push) s tajným kľúčom.
// Telo: { event, id, actor }. Funkcia zistí, komu a čo poslať, podľa nastavení na účte (prefs),
// nikdy nie tomu, kto akciu urobil; v noci (22:00 – 7:00, Bratislava) nič okrem žiadostí počas nákupu.
// Texty sú krátke a bez skloňovania mien („Nakupuje: Lucia“). Neplatné odbery sa vypnú (disabled_at).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type Vapid } from "../_shared/webpush.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type Locale = "sk" | "en";
type Kind = "start" | "request" | "reply" | "unavailable" | "end" | "receiptRead";
type Msg = { title: string; body: string; url: string; tag?: string };
type Out = { users: string[]; kind: Kind; quiet: boolean; msg: (l: Locale) => Msg };

const eur = (v: number | null, l: Locale) =>
  v == null ? "" : new Intl.NumberFormat(l === "sk" ? "sk-SK" : "en-GB", { style: "currency", currency: "EUR" }).format(Number(v));

/** V noci (Bratislava) sa tiché upozornenia neposielajú. */
function night(): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bratislava", hour: "2-digit", hour12: false }).format(new Date()));
  return h >= 22 || h < 7;
}

async function names(admin: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  if (!list.length) return new Map();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", list);
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name as string) || "?"]));
}

/** Kto vidí zoznam: členovia domácnosti, pri súkromnom zozname len autor. */
async function audience(admin: SupabaseClient, list: { household_id: string; is_private: boolean; created_by: string | null }): Promise<string[]> {
  if (list.is_private) return list.created_by ? [list.created_by] : [];
  const { data } = await admin.from("household_members").select("user_id").eq("household_id", list.household_id);
  return (data ?? []).map((m) => m.user_id as string);
}

async function plan(admin: SupabaseClient, event: string, id: string, actor: string | null): Promise<Out | null> {
  if (event === "start" || event === "end") {
    const { data: s } = await admin.from("shopping_sessions").select("id, list_id, shopper_id, started_at").eq("id", id).maybeSingle();
    if (!s) return null;
    const { data: list } = await admin.from("shopping_lists").select("name, household_id, is_private, created_by").eq("id", s.list_id).maybeSingle();
    if (!list) return null;
    const who = (await names(admin, [s.shopper_id])).get(s.shopper_id) ?? "?";
    const users = (await audience(admin, list)).filter((u) => u !== s.shopper_id);
    if (event === "start")
      return {
        users, kind: "start", quiet: true,
        msg: (l) => ({
          title: l === "sk" ? `Nakupuje: ${who}` : `Shopping now: ${who}`,
          body: l === "sk" ? `${list.name} · chceš niečo pridať? Ťukni.` : `${list.name} · want to add something? Tap.`,
          url: `/lists/${s.list_id}?sledovat=1`, tag: `shop-${s.id}`,
        }),
      };
    const { count } = await admin.from("shopping_list_items").select("id", { count: "exact", head: true })
      .eq("list_id", s.list_id).eq("status", "PURCHASED").gte("purchased_at", s.started_at);
    return {
      users, kind: "end", quiet: true,
      msg: (l) => ({
        title: l === "sk" ? `Nákup skončil: ${list.name}` : `Shopping finished: ${list.name}`,
        body: l === "sk" ? `Kúpené: ${count ?? 0} · ${who}` : `Bought: ${count ?? 0} · ${who}`,
        url: `/lists/${s.list_id}`, tag: `shop-${s.id}`,
      }),
    };
  }
  if (event === "request" || event === "reply") {
    const { data: r } = await admin.from("addition_requests").select("id, session_id, list_id, requested_by, requested_for, name, quantity, unit, status").eq("id", id).maybeSingle();
    if (!r) return null;
    const n = await names(admin, [r.requested_by, r.requested_for]);
    const qty = r.quantity ? ` · ${Number(r.quantity)} ${r.unit ?? "ks"}` : "";
    if (event === "request")
      return {
        users: [r.requested_for].filter((u) => u && u !== actor), kind: "request", quiet: false,
        msg: (l) => ({
          title: l === "sk" ? `Pridať do košíka? Od: ${n.get(r.requested_by) ?? "?"}` : `Add to cart? From: ${n.get(r.requested_by) ?? "?"}`,
          body: `${r.name}${qty}`, url: `/lists/${r.list_id}`, tag: `req-${r.session_id}`,
        }),
      };
    const ok = r.status === "ACCEPTED";
    return {
      users: [r.requested_by].filter((u) => u && u !== actor) as string[], kind: "reply", quiet: false,
      msg: (l) => ({
        title: ok ? (l === "sk" ? `Pridané do košíka: ${r.name}` : `Added to cart: ${r.name}`) : (l === "sk" ? `Nepridané: ${r.name}` : `Not added: ${r.name}`),
        body: l === "sk" ? `Nakupuje: ${n.get(r.requested_for) ?? "?"}` : `Shopper: ${n.get(r.requested_for) ?? "?"}`,
        url: `/lists/${r.list_id}`, tag: `reply-${r.id}`,
      }),
    };
  }
  if (event === "unavailable") {
    const { data: it } = await admin.from("shopping_list_items").select("id, list_id, name, added_by, purchased_by").eq("id", id).maybeSingle();
    if (!it || !it.added_by || it.added_by === (actor ?? it.purchased_by)) return null;
    const { data: list } = await admin.from("shopping_lists").select("name").eq("id", it.list_id).maybeSingle();
    return {
      users: [it.added_by], kind: "unavailable", quiet: false,
      msg: (l) => ({ title: l === "sk" ? `Nemali: ${it.name}` : `Not in store: ${it.name}`, body: list?.name ?? "", url: `/lists/${it.list_id}`, tag: `na-${it.id}` }),
    };
  }
  if (event === "receipt") {
    const { data: rc } = await admin.from("receipts").select("id, uploaded_by, status, store_name, total").eq("id", id).maybeSingle();
    if (!rc?.uploaded_by) return null;
    const review = rc.status === "NEEDS_REVIEW";
    return {
      users: [rc.uploaded_by], kind: "receiptRead", quiet: true,
      msg: (l) => ({
        title: review ? (l === "sk" ? "Bloček treba skontrolovať" : "Receipt needs a check") : (l === "sk" ? "Bloček je prečítaný" : "Receipt read"),
        body: [rc.store_name, eur(rc.total, l)].filter(Boolean).join(" · "),
        url: `/receipts/${rc.id}`, tag: `rc-${rc.id}`,
      }),
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "VALIDATION" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ok = await admin.rpc("check_worker_secret", { p_secret: req.headers.get("x-worker-secret") ?? "" });
  if (ok.error || ok.data !== true) return json({ error: "FORBIDDEN" }, 403);
  const { event, id, actor } = (await req.json().catch(() => ({}))) as { event?: string; id?: string; actor?: string | null };
  if (!event || !id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "VALIDATION" }, 400);

  const out = await plan(admin, event, id, actor ?? null);
  const users = out ? out.users.filter((u) => u && u !== actor) : [];
  if (!out || !users.length) return json({ sent: 0 });
  if (out.quiet && night()) return json({ sent: 0, night: true });

  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, locale, prefs").in("user_id", users).is("disabled_at", null);
  const v = (await admin.rpc("push_vapid")).data as { public?: string; private?: string } | null;
  if (!v?.public || !v.private) return json({ error: "VAPID_MISSING" }, 500);
  const vapid: Vapid = { publicKey: v.public, privateJwk: JSON.parse(v.private), subject: "mailto:noreply@basket-harmony.app" };

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      if ((s.prefs as Record<string, unknown>)?.[out.kind] === false) return;
      const m = out.msg(s.locale === "en" ? "en" : "sk");
      try {
        const status = await sendPush(s, m, vapid, { topic: m.tag, urgency: out.quiet ? "normal" : "high", ttl: out.kind === "request" ? 900 : 3600 });
        if (status === 404 || status === 410) await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", s.id);
        else if (status < 300) {
          sent++;
          await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
        } else console.error("push-send", event, status);
      } catch (e) {
        console.error("push-send", event, String(e));
      }
    }),
  );
  return json({ sent });
});
