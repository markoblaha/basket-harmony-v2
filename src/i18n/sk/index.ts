/**
 * Slovenské texty (zdroj pravdy). Každý modul má vlastný predpona kľúčov
 * (common, more, error, category, ...), takže sa pri spojení neprepíšu.
 */
import { skCategories } from "./categories";
import { skCommon } from "./common";
import { skErrors } from "./errors";
import { skMore } from "./more";
import { skVoice } from "./voice";
import { skTrips } from "./trips";
import { skAnalytics } from "./analytics";
import { skLists } from "./lists";
import { skAuth } from "./auth";
import { skReceipts } from "./receipts";
import { skRecipes } from "./recipes";
import { skLs } from "./ls";

export const skModules = [skCommon, skMore, skVoice, skTrips, skAnalytics, skLists, skAuth, skReceipts, skRecipes, skLs, skErrors, skCategories] as const;

export const sk = {
  ...skCommon,
  ...skMore,
  ...skVoice,
  ...skTrips,
  ...skAnalytics,
  ...skLists,
  ...skAuth,
  ...skReceipts,
  ...skRecipes,
  ...skLs,
  ...skErrors,
  ...skCategories,
} as const;
