import type { skLegal } from "../sk/legal";

export const enLegal: Record<keyof typeof skLegal, string> = {
  "legal.back": "Back",
  "legal.updated": "Effective 3 November 2026",
  "legal.operator": "Operator: to be added before the app is published (name or company and contact e-mail).",
  "legal.linkPrivacy": "Privacy policy",
  "legal.linkTerms": "Terms of use",
  "legal.signupNote": "By creating an account you agree to the terms of use and acknowledge the privacy policy.",
  "legal.moreRow": "Privacy and terms",
  "legal.moreRowSub": "What data the app processes and why",

  "legal.privacy.title": "Privacy policy",
  "legal.privacy.intro":
    "Basket Harmony is a shared shopping list, recipe book and spending overview for a household. Here is, in plain words, what data the app processes, why, and how you can delete it.",
  "legal.privacy.s1.t": "Who processes your data",
  "legal.privacy.s1.b":
    "The app's operator is responsible for your data. Send questions and requests (access, correction, deletion) to the operator's contact below.",
  "legal.privacy.s2.t": "What data",
  "legal.privacy.s2.b":
    "• Account: e-mail, the name you choose and, with Google sign-in, the name from your Google account.\n• Household: members, lists, items, requests during shopping, recipes, week plan, budgets.\n• Receipts: receipt photos and the items, prices, store and date read from them. A bank statement only if you upload one.\n• Voice: the recording of a sentence is sent for processing and isn't stored in the app; only the result (items) is saved.\n• Phone settings (appearance, language, notifications) stay on the device only.",
  "legal.privacy.s3.t": "What for",
  "legal.privacy.s3.b":
    "The data is used only to run the app: a shared household list, shopping estimates from your receipts, spending overviews and recipes. We don't sell it, don't use it for advertising and don't track you across the web. The legal basis is performance of the contract (using the app).",
  "legal.privacy.s4.t": "Who else sees it",
  "legal.privacy.s4.b":
    "• Other members of your household see the shared lists, receipts and spending. Only you see your private lists.\n• Supabase (database and storage, servers in Frankfurt, EU).\n• Google (Gemini API – reading receipts and statements, understanding voice and finding recipes; Google sign-in if you use it). Google processes the data as a processor under the Gemini API terms.\n• Cloudflare (delivering the app to your browser).",
  "legal.privacy.s5.t": "How long",
  "legal.privacy.s5.b":
    "As long as you have an account. Household data stays as long as the household exists – even when one member leaves. When you delete your account, your profile is deleted immediately; if you were the last member of a household, the whole household is deleted with its receipts and their photos. Database backups are overwritten within 30 days.",
  "legal.privacy.s6.t": "Your rights",
  "legal.privacy.s6.b":
    "• Download your spending: More → Export.\n• Correct your name: More → profile.\n• Delete your account: More → Delete account (permanent, no need to write to us).\n• Ask for access to or correction of your data: the operator's contact.\n• Complain to the Slovak data protection authority (dataprotection.gov.sk).",
  "legal.privacy.s7.t": "Changes",
  "legal.privacy.s7.b": "We will let you know in the app about any significant changes to this policy.",

  "legal.terms.title": "Terms of use",
  "legal.terms.intro": "Short and clear: what the app promises and what it expects from you.",
  "legal.terms.s1.t": "The app",
  "legal.terms.s1.b":
    "Basket Harmony is for shared shopping, recipes and a household spending overview. You can close your account at any time in More → Delete account.",
  "legal.terms.s2.t": "Estimates and AI",
  "legal.terms.s2.b":
    "Prices in a list are estimates from your past receipts, not a store offer. Receipts, voice and recipes are processed by AI and it can make mistakes – check important amounts. AI recipes are labelled.",
  "legal.terms.s3.t": "Fair use",
  "legal.terms.s3.b":
    "The app is for a household. AI has daily and monthly limits per household so the app stays available for everyone. Don't upload other people's data or content you have no right to, and don't misuse the app for attacks or mass automated requests.",
  "legal.terms.s4.t": "Liability",
  "legal.terms.s4.b":
    "We provide the app as it is and take care that it works and your data is safe. We aren't liable for decisions based on estimates and overviews. If something doesn't work, write to the operator's contact.",
};
