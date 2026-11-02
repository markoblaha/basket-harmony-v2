/** Otvorí hlasový režim z ľubovoľného miesta (napr. mikrofón v poli zoznamu). */
export const VOICE_EVENT = "bh:voice";
export function openVoice(listId?: string) {
  window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: { listId } }));
}
