/** Anglické texty. Typ `Record<Key, string>` zaručí, že nechýba ani jeden kľúč zo slovenčiny. */
import type { sk } from "../sk";
import { enCategories } from "./categories";
import { enCommon } from "./common";
import { enErrors } from "./errors";
import { enMore } from "./more";
import { enVoice } from "./voice";
import { enTrips } from "./trips";
import { enAnalytics } from "./analytics";
import { enLists } from "./lists";
import { enAuth } from "./auth";
import { enReceipts } from "./receipts";

export const enModules = [enCommon, enMore, enVoice, enTrips, enAnalytics, enLists, enAuth, enReceipts, enErrors, enCategories] as const;

export const en: Record<keyof typeof sk, string> = {
  ...enCommon,
  ...enMore,
  ...enVoice,
  ...enTrips,
  ...enAnalytics,
  ...enLists,
  ...enAuth,
  ...enReceipts,
  ...enErrors,
  ...enCategories,
};
