import type { ComponentType, SVGProps } from "react";

/** Ilustrácie jedál katalógu podľa id receptu (dishes.jsx). */
export const DISHES: Record<string, ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>>;
export function Dish(props: { id: string; size?: number; strokeWidth?: number }): React.JSX.Element | null;
