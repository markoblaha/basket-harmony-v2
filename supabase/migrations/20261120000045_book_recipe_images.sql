-- Kniha receptov: viac fotiek na recept a dočasné originálne fotky zo zdroja (pokyn majiteľa 20. 11.).
-- image_count = počet fotiek (súbory <id>-1.webp … <id>-N.webp vedľa image_path); image_status 'source' = fotky zo stránky
-- zdroja, len dočasne – predloha pre vlastné fotky z Gemini, potom sa nahradia ('generated') a originály sa zmažú.
alter table public.book_recipes add column image_count smallint not null default 0 check (image_count between 0 and 10);
alter table public.book_recipes drop constraint book_recipes_image_status_check;
alter table public.book_recipes add constraint book_recipes_image_status_check
  check (image_status in ('none', 'batch_label', 'source', 'generated'));
update public.book_recipes set image_count = 1 where image_path is not null and image_count = 0;
