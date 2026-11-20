-- Kniha receptov: podkategória (napr. sladké → torty, cheesecaky; mäso → hovädzie) a výťažok receptu zo zdroja
-- („1 cheesecake (forma Ø 20 cm)“, „20 laskoniek“) – pri koláčoch a tortách sa namiesto porcií ukáže výťažok (pokyn 20. 11.).
alter table public.book_recipes add column subcategory text check (subcategory is null or subcategory ~ '^[a-z_]+$');
alter table public.book_recipes add column yield_text text check (yield_text is null or length(yield_text) between 1 and 80);
