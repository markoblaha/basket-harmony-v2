/** Anglické texty. Typ `Record<Key, string>` zaručí, že nechýba ani jeden kľúč zo slovenčiny. */
import type { sk } from "../sk";
import { enCategories } from "./categories";
import { enCommon } from "./common";
import { enErrors } from "./errors";
import { enMore } from "./more";
import { enAnalytics } from "./analytics";
import { enLists } from "./lists";
import { enAuth } from "./auth";
import { enReceipts } from "./receipts";

export const enModules = [enCommon, enMore, enAnalytics, enLists, enAuth, enReceipts, enErrors, enCategories] as const;

export const en: Record<keyof typeof sk, string> = {
  ...enCommon,
  ...enMore,
  ...enAnalytics,
  ...enLists,
  ...enAuth,
  ...enReceipts,
  ...enErrors,
  ...enCategories,
};
