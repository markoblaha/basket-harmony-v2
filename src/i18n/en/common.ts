import type { skCommon } from "../sk/common";

export const enCommon: Record<keyof typeof skCommon, string> = {
  "app.description": "Shared household shopping list",

  "nav.label": "Main navigation",
  "nav.shopping": "Shopping lists",
  "nav.lists": "Lists",
  "nav.recipes": "Recipes",
  "nav.waiting.one": "{n} waiting",
  "nav.waiting.few": "{n} waiting",
  "nav.waiting.other": "{n} waiting",
  "nav.receipts": "Receipts",
  "nav.analytics": "Analytics",
  "nav.more": "More",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.back": "Back",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.retry": "Try again",
  "common.loadFailed": "Couldn't load the data",

  "common.undo": "Undo",
  "kit.remove": "Remove",
  "kit.less": "Less",
  "kit.more": "More",

  "status.offline": "You're offline – changes won't be saved until you reconnect.",
  "status.reconnecting": "Restoring live connection…",
  "status.testEnv": "Test environment",
  "unit.ks": "pcs",
  "unit.bal": "pack",
};
