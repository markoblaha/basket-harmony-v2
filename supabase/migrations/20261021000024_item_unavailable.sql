-- Nový stav položky „Nemali“ (UNAVAILABLE): nakupujúci ju v obchode nenašiel.
-- Hodnota enumu musí byť v samostatnej migrácii – v tej istej transakcii sa nedá použiť.
alter type public.item_status add value if not exists 'UNAVAILABLE';
