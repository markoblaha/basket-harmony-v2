-- Jazyk textu receptu knihy (20. 11. 2026, rozhodnutie majiteľa): recept sa ukladá presne v jazyku a znení zdroja
-- (české po česky, slovenské po slovensky). Preklady (cs → sk, sk → cs) prídu neskôr ako samostatná vrstva.
alter table public.book_recipes add column lang text not null default 'sk' check (lang ~ '^[a-z]{2}$');
