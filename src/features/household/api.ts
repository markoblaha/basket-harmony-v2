/**
 * Prístup k údajom o domácnosti. Obrazovky nevolajú databázu priamo –
 * volajú tieto funkcie. Keď sa raz zmení databáza, upravuje sa iba tento súbor.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Row } from "@/lib/database.types";

export const keys = {
  households: ["households"] as const,
  members: (hid: string) => ["members", hid] as const,
  profiles: ["profiles"] as const,
  invitations: (hid: string) => ["invitations", hid] as const,
};

export type Household = Pick<Row<"households">, "id" | "name" | "created_at">;
export type Member = Row<"household_members"> & { display_name: string };

export function useHouseholds() {
  return useQuery({
    queryKey: keys.households,
    queryFn: async (): Promise<Household[]> => {
      const { data, error } = await supabase.from("households").select("id, name, created_at").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Mená všetkých ľudí, ktorých smiem vidieť (ja + členovia mojich domácností). */
export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name");
      if (error) throw error;
      return new Map(data.map((p) => [p.id, p.display_name]));
    },
    staleTime: 60_000,
  });
}

export function useMembers(householdId: string) {
  const profiles = useProfiles();
  const members = useQuery({
    queryKey: keys.members(householdId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, user_id, role, joined_at")
        .eq("household_id", householdId)
        .order("joined_at");
      if (error) throw error;
      return data;
    },
  });
  const data: Member[] | undefined =
    members.data &&
    members.data.map((m) => ({ ...m, display_name: profiles.data?.get(m.user_id) ?? "Člen domácnosti" }));
  return { ...members, data };
}

export function useInvitations(householdId: string) {
  return useQuery({
    queryKey: keys.invitations(householdId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_invitations")
        .select("id, status, expires_at, created_at, created_by")
        .eq("household_id", householdId)
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.rpc("create_household", { p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.households }),
  });
}

export function useCreateInvitation(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_invitation", { p_household_id: householdId });
      if (error) throw error;
      const result = data as { token: string; expires_at: string };
      return { ...result, url: `${window.location.origin}/join/${result.token}` };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invitations(householdId) }),
  });
}

export function useRevokeInvitation(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invitations(householdId) }),
  });
}

export type InvitationPreview = {
  state: "VALID" | "INVALID" | "USED" | "EXPIRED" | "ALREADY_MEMBER";
  household_id?: string;
  household_name?: string;
  invited_by?: string;
  expires_at?: string;
};

export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("invitation_preview", { p_token: token });
      if (error) throw error;
      return data as InvitationPreview;
    },
    retry: false,
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.households });
      await qc.invalidateQueries({ queryKey: keys.profiles });
    },
  });
}

export function useRenameHousehold(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("households").update({ name }).eq("id", householdId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.households }),
  });
}

export function useLeaveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.rpc("leave_household", { p_household_id: householdId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.households }),
  });
}

export function useRemoveMember(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_member", { p_household_id: householdId, p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.members(householdId) }),
  });
}

export function useUpdateDisplayName(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profiles }),
  });
}
