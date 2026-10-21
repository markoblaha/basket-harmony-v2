import { Outlet } from "react-router";

/** Rám Analytiky: každá časť (Prehľad, Kategórie, Obchody) má vlastnú hlavičku s obdobím (akit.tsx). */
export function AnalyticsLayout() {
  return <Outlet />;
}
