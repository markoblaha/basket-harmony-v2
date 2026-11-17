import type { ComponentType, SVGProps } from "react";

/** Ilustrácie jedál katalógu podľa id receptu (dishes.jsx). */
export const DISHES: Record<string, ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>>;
export function Dish(props: { id: string; size?: number; strokeWidth?: number }): React.JSX.Element | null;
/** Len pre test (dishes.test.tsx): hotové výsledky orezania čiar. */
export function setBakedCuts(on: boolean): void;
export const cutCache: Map<string, string>;
export function cutKey(key: string): string;
