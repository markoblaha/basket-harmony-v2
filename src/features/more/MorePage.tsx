import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ChevronRight, LogOut, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Avatar, Button, Group, PageHeader, Row, Section, Sheet, TextField } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth, useUserId } from "@/features/auth/AuthProvider";
import { useHousehold } from "@/features/household/HouseholdProvider";
import { useMembers, useProfiles, useUpdateDisplayName } from "@/features/household/api";
import { formatDateTime, t, tn } from "@/i18n";
import { LanguagePicker, ThemePicker } from "./AppearancePicker";

/**
 * Viac = nastavenia. Hlavná stránka je rozcestník: kto som a v akej domácnosti,
 * vzhľad a jazyk (prepínajú sa hneď tu) a odhlásenie. Správa domácnosti
 * (členovia, pozvánky, odchod) má vlastnú stránku /more/household.
 */
export function MorePage() {
  const { user } = useAuth();
  const me = useUserId();
  const { household } = useHousehold();
  const toast = useToast();
  const members = useMembers(household.id);
  const profiles = useProfiles();
  const updateName = useUpdateDisplayName(me);

  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState("");

  const currentName = profiles.data?.get(me) ?? "";
  const email = user?.email ?? "";
  const shownName = currentName || email.split("@")[0] || "";

  function openProfile() {
    setName(currentName);
    setProfileOpen(true);
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === currentName) return;
    try {
      await updateName.mutateAsync(next);
      setProfileOpen(false);
      toast.show(t("more.profile.saved"), "success");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      <PageHeader title={t("more.title")} />

      {/* Kto som a kde nakupujem: horná časť upraví profil, dolná otvorí správu domácnosti. */}
      <Section>
        <div className="overflow-hidden rounded-[var(--radius-surface)] bg-surface shadow-card">
          <button
            type="button"
            onClick={openProfile}
            aria-label={t("more.profile.edit")}
            className="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-pressed"
          >
            <Avatar name={shownName} me size="xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-semibold">{shownName}</span>
              <span className="block truncate text-sm text-text-2">{email}</span>
            </span>
            <Pencil className="size-4 shrink-0 text-text-3" aria-hidden />
          </button>
          <div className="mx-4 border-t border-line" aria-hidden />
          <Link to="/more/household" className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-pressed">
            <span className="min-w-0 flex-1">
              <span className="block text-footnote text-text-2">{t("more.household")}</span>
              <span className="block truncate font-strong">{household.name}</span>
            </span>
            {members.data && <span className="shrink-0 text-sm text-text-2">{tn("more.memberCount", members.data.length)}</span>}
            <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
          </Link>
        </div>
      </Section>

      <Section title={t("more.appearance.title")}>
        <ThemePicker />
      </Section>

      <Section title={t("more.language.title")}>
        <LanguagePicker />
      </Section>

      <Section>
        <Group>
          <Row icon={<LogOut className="size-5" />} label={t("more.signOut")} onClick={() => supabase.auth.signOut()} />
        </Group>
        <p className="mt-4 text-center text-xs text-text-3">
          Basket Harmony · {t("more.build", { date: formatDateTime(__BUILD_TIME__, { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}
        </p>
      </Section>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title={t("more.profile.title")}>
        <form onSubmit={saveName} className="flex flex-col gap-4">
          <TextField label={t("more.profile.nameLabel")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          <TextField label={t("more.profile.email")} value={email} readOnly disabled />
          <Button type="submit" size="lg" block loading={updateName.isPending} disabled={!name.trim() || name.trim() === currentName}>
            {t("common.save")}
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
