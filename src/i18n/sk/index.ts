/**
 * Slovenské texty (zdroj pravdy). Každý modul má vlastný predpona kľúčov
 * (common, more, error, category, ...), takže sa pri spojení neprepíšu.
 */
import { skCategories } from "./categories";
import { skCommon } from "./common";
import { skErrors } from "./errors";
import { skMore } from "./more";
import { skAnalytics } from "./analytics";
import { skLists } from "./lists";
import { skAuth } from "./auth";
import { skReceipts } from "./receipts";

export const skModules = [skCommon, skMore, skAnalytics, skLists, skAuth, skReceipts, skErrors, skCategories] as const;

export const sk = {
  ...skCommon,
  ...skMore,
  ...skAnalytics,
  ...skLists,
  ...skAuth,
  ...skReceipts,
  ...skErrors,
  ...skCategories,
} as const;
