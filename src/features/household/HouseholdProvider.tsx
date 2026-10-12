/**
 * Aktuálna domácnosť. Databáza dovoľuje byť vo viacerých domácnostiach;
 * aplikácia vždy pracuje s jednou vybranou (zapamätá si ju v prehliadači).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { errorMessage } from "@/lib/errors";
import { ErrorState, Spinner } from "@/components/ui";
import { useHouseholds, type Household } from "./api";

const STORAGE_KEY = "bh.householdId";

type HouseholdState = {
  household: Household;
  households: Household[];
  select: (id: string) => void;
};

const HouseholdContext = createContext<HouseholdState | null>(null);

export function rememberHousehold(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* súkromný režim prehliadača – nevadí */
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const households = useHouseholds();
  const location = useLocation();
  const [selected, setSelected] = useState<string | null>(readStored);

  const household = useMemo(() => {
    const list = households.data ?? [];
    return list.find((h) => h.id === selected) ?? list[0] ?? null;
  }, [households.data, selected]);

  useEffect(() => {
    if (household) rememberHousehold(household.id);
  }, [household]);

  if (households.isPending) return <Spinner />;
  if (households.isError) return <ErrorState error={errorMessage(households.error)} onRetry={() => households.refetch()} />;
  if (!household) {
    // Ešte nie je v žiadnej domácnosti -> úvodné nastavenie.
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return (
    <HouseholdContext.Provider value={{ household, households: households.data, select: setSelected }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold mimo HouseholdProvider");
  return ctx;
}
