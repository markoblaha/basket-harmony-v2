/**
 * Ikony kategórií a oblastí rozpočtu (Lucide, jednotná čiara). Nahrádzajú emoji –
 * vyzerajú rovnako na každom telefóne a ladia s ostatnými ikonami aplikácie.
 */
import {
  Baby, Bath, Beef, Candy, Car, Coffee, Croissant, CupSoda, Fuel, Ham, House, Landmark, Milk, Package, PawPrint, Pill,
  Plug, Receipt, Recycle, Shirt, ShieldCheck, ShoppingBasket, ShoppingCart, Smartphone, Snowflake, Sofa, SprayCan, Tag,
  Ticket, ToyBrick, UtensilsCrossed, Carrot, Wine, type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

const ICONS: Record<string, LucideIcon> = {
  // kategórie (src/lib/categories.ts)
  groceries: ShoppingBasket,
  produce: Carrot,
  bakery: Croissant,
  dairy_eggs: Milk,
  deli_chilled: Ham,
  meat_fish: Beef,
  frozen: Snowflake,
  pantry: Package,
  breakfast: Coffee,
  snacks_sweets: Candy,
  beverages: CupSoda,
  alcohol: Wine,
  household_cleaning: SprayCan,
  personal_care: Bath,
  health: Pill,
  baby: Baby,
  pet: PawPrint,
  clothing: Shirt,
  home: Sofa,
  toys_hobby: ToyBrick,
  electronics: Plug,
  fuel: Fuel,
  transport: Car,
  dining: UtensilsCrossed,
  leisure: Ticket,
  fees: Landmark,
  deposit: Recycle,
  housing: House,
  telecom: Smartphone,
  insurance: ShieldCheck,
  other: ShoppingCart,
  // účtovné riadky Prehľadov
  _unassigned: Receipt,
  _receipt_discount: Tag,
  // oblasti rozpočtu (src/features/analytics/areas.ts), ktoré nemajú vlastnú kategóriu
  food: ShoppingBasket,
  household: SprayCan,
  kids: Baby,
  car: Car,
  finance: ShieldCheck,
};

export function CategoryGlyph({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? ShoppingCart;
  return <Icon className={cx("shrink-0", className)} strokeWidth={1.85} aria-hidden />;
}
