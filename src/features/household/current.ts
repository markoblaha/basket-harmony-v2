/** Aktuálna domácnosť pre volania mimo komponentov (AI funkcie ju potrebujú na kontrolu členstva a limit). */
let current: string | null = null;

export const currentHouseholdId = () => current;
export const setCurrentHouseholdId = (id: string | null) => {
  current = id;
};
