// Skutočné bločky domácnosti z testovacej databázy (aug.–okt. 2026): produkty a bločky s položkami.
// Produkt: názov|kategória|značka|balenie|druh.
// Riadok bločku: obchod|MM-DD|čas|suma|položky; položka: index produktu,množstvo,k (=kg),cena za jednotku,suma riadku
export const RAW_PRODUCTS = `Penový čistič vodného kameňa 3x silnejší|household_cleaning|HG||Penový čistič vodného kameňa 3x silnejší
WC blok Color Aktiv Flower|household_cleaning|Bref|200g|WC blok Color Aktiv Flower
Dezodorant Lower Body Pear & Cedarwood|personal_care|Axe|100ml|Dezodorant
Dezodorant Epic Fresh|personal_care|Axe|250ml|Dezodorant
Krém na ruky Profi Univerzal|personal_care|Indulona|100ml|Krém na ruky
Ochranný krém na ruky SOS|personal_care|Indulona|100ml|Krém na ruky
Alkalické batérie Ultra LR03 (AAA)|electronics|AlzaPower|10ks|Batérie
Doprava|fees|||Doprava
Ovocný nápoj Mystic Dragon|beverages|Capri-Sun||Džús a ovocný nápoj
Kuracie prsné rezne|meat_fish|||Kuracie prsia
Feta syr|dairy_eggs|||Feta syr
Cuketa|produce|||Cuketa
Rožok|bakery|||Rožky a žemle
Donut s čokoládovou polevou|bakery|||Sladké pečivo
Vodný filter pre kávovary De'Longhi|home|Siguro||Vodný filter pre kávovary De'Longhi
Filtre do kanvice pre extra tvrdú vodu|home|BWT|3ks|Filtre do kanvice pre extra tvrdú vodu
Elektrický osviežovač vzduchu náplň Maracuja a tropické mango|household_cleaning|Air Wick|19ml|Osviežovač vzduchu
Antiperspirant Men Extreme Fresh|personal_care|Rexona|50ml|Dezodorant
Osviežovač vzduchu Bathroom Floral Cherry|household_cleaning|Glade|180g|Osviežovač vzduchu
Sushi ryža|pantry|Sensei|1000g|Ryža
Sushi zázvor ružový|pantry|Golden Turtle|240g|Sushi zázvor
Wasabi pasta v tube|pantry|Kingzest|43g|Wasabi pasta v tube
Ryžový ocot|pantry|Thai Dancer|300ml|Ryžový ocot
Morské riasy Nori|pantry|Gimbap Gim|30g|Riasy Nori
Morské riasy Yaki Sushi Nori|pantry|JH Foods|28g|Riasy Nori
Bambusová podložka na sushi|home|||Bambusová podložka na sushi
Surimi krabie tyčinky|meat_fish||500g|Surimi krabie tyčinky
Krevety na sushi Ebi|meat_fish|Tom Lam|260g|Krevety na sushi Ebi
Instantná polievka Tom Yum|pantry|FF|65g|Instantná polievka
Instantná polievka Tom Yum Seafood|pantry|FF|60g|Instantná polievka
Instantná rezancová polievka kuracia pikantná|pantry|Nongshim|100g|Instantná polievka
Instantné sklenené rezance s krabou príchuťou|pantry|Hoang Gia|105g|Instantná polievka
Instantná polievka s krevetovou príchuťou|pantry|Hoang Gia|130g|Instantná polievka
Snack z morských rias wasabi|snacks_sweets|Bibigo|15g|Snack z morských rias wasabi
Prostriedok na riad granátové jablko|household_cleaning|||Prostriedok na riad granátové jablko
Prací prostriedok Color|household_cleaning|Persil||Prací prostriedok
Prací prostriedok|baby|Lovela||Prací prostriedok
Kuchynské utierky|household_cleaning||200ks|Kuchynské utierky
Osviežovač vzduchu Muguet|household_cleaning|Glade||Osviežovač vzduchu
Hliníková fólia|household_cleaning|||Hliníková fólia
Treska v majonéze|deli_chilled|||Treska v majonéze
Zubná pasta Max White|personal_care|Colgate||Zubná pasta
Avokádo|produce|||Avokádo
Banány|produce|||Banány
Bochník viaczrnný|bakery|||Chlieb
Šiška s nugátovou náplňou|bakery|||Sladké pečivo
Záloha za obal|deposit|||Záloha za obal
Podložky na prebaľovanie|baby|babylove|10ks|Podložky na prebaľovanie
Vlhčené utierky 99 % vody|baby|babylove|320ks|Vlhčené utierky 99 % vody
Dojčenská šťava|baby|babylove|700ml|Dojčenská šťava
Prsné vložky|baby|babylove|60ks|Prsné vložky
Detské kozmetické utierky|baby|babylove|150ks|Detské kozmetické utierky
Plienky Mini|baby|babylove|42ks|Plienky
Záloha za PET fľašu|deposit|||Záloha za PET fľašu
Tekuté mydlo Sensitive náhradná náplň|personal_care|Balea|850ml|Tekuté mydlo Sensitive náhradná náplň
Detský olej na ďasná Prvý zúbok|baby|Saloos|10ml|Detský olej na ďasná Prvý zúbok
Detské hryzátko|baby|babylove|1ks|Hryzátko
Jaternice|deli_chilled|||Jaternice a krvavnice
Krvavnice|deli_chilled|||Jaternice a krvavnice
Pikantná klobása|deli_chilled|||Klobása
Chorizo|deli_chilled|||Chorizo
Domáci chren ostrý|pantry|||Domáci chren ostrý
Papriková pomazánka pikantná|pantry|||Papriková pomazánka pikantná
Drevená hrazdička s hračkami|baby|||Drevená hrazdička s hračkami
Detské hryzátko|baby|BabyOno|1ks|Hryzátko
Tablety do umývačky riadu Quantum All in 1 Fresh|household_cleaning|Finish|80ks|Do umývačky riadu
Pančuchové nohavice|clothing|||Dámske oblečenie
Dojčenský šál|clothing|||Detské oblečenie
Vodná pištoľ|toys_hobby|||Vodná pištoľ
Dojčenské šortky chlapčenské|clothing|||Detské oblečenie
Dojčenské tričko chlapčenské|clothing|||Detské oblečenie
Dojčenská mikina|clothing||2ks|Detské oblečenie
Nákupná taška|other|||Nákupná taška
Dojčenské legíny chlapčenské|clothing|||Detské oblečenie
Sviečka|home|||Sviečka
Súprava na skicovanie|toys_hobby|||Súprava na skicovanie
Modelovacia hmota|toys_hobby|||Modelovacia hmota
Pánske ponožky|clothing|||Pánske oblečenie
Plyšová hračka|toys_hobby|||Plyšová hračka
Dámske tričko|clothing|||Dámske oblečenie
Dojčenská súprava chlapčenská|baby|||Detské oblečenie
Dojčenské nohavice chlapčenské|baby|||Detské oblečenie
Zápisník|toys_hobby|||Zápisník
Dojčenské body chlapčenské|baby|||Detské oblečenie
Detská mikina|clothing||2ks|Detské oblečenie
Dojčenská kombinéza chlapčenská|baby|||Detské oblečenie
Detská trojdielna súprava|clothing||3ks|Detské oblečenie
Dojčenská mikina chlapčenská|baby|||Detské oblečenie
Detské tričko s krátkym rukávom s potlačou|clothing|||Detské oblečenie
Dievčenské šaty|clothing|||Detské oblečenie
Záhradné doplnky|home|||Záhradné doplnky
Stolík|home|||Stolík
Záhradná súprava|home|||Záhradná súprava
Tekutina na mydlové bubliny|toys_hobby|||Tekutina na mydlové bubliny
Pánska mikina s okrúhlym výstrihom|clothing|||Pánske oblečenie
Cestovné príslušenstvo|other|||Cestovné príslušenstvo
Chlapčenská mikina|clothing|Bekkin||Detské oblečenie
Pánska mikina s kapucňou|clothing|||Pánske oblečenie
Dámske tričko bez rukávov|clothing|||Dámske oblečenie
Dojčenské body chlapčenské|clothing||2ks|Detské oblečenie
Svetlé pivo 10°|alcohol|Radegast|500ml|Pivo
Záloha za plechovku|deposit|||Záloha za plechovku
Minerálna voda jemne perlivá|beverages|Mattoni|500ml|Minerálna voda
Zemiakové lupienky vrúbkované morská soľ|snacks_sweets|Slovakia|120g|Zemiakové lupienky
Pálivé feferóny|pantry|Efko||Feferóny
Feferóny baranie rohy|pantry||330g|Feferóny
Rožok|bakery|Penam|50g|Rožky a žemle
Donut s čokoládovou polevou|bakery|La Lorraine|55g|Sladké pečivo
Donut škoricový s jablkovou náplňou|bakery|La Lorraine|65g|Sladké pečivo
Roztok na prerezávanie zúbkov|health|Camilia|10ml|Roztok na prerezávanie zúbkov
Zubný gél Dentinox N|health|Dentinox|10g|Zubný gél Dentinox N
Osviežovač vzduchu Zvodná pivónia a višňa|household_cleaning|Glade|300ml|Osviežovač vzduchu
Vložky do topánok In-Balance Plantar Fasciitis Large|health|Scholl||Vložky do topánok In-Balance Plantar Fasciitis Large
Svetlé pivo 12°|alcohol|Heineken|500ml|Pivo
Svetlé pivo 12°|alcohol|Radegast|500ml|Pivo
Motorová nafta EVO Diesel|fuel|||Motorová nafta EVO Diesel
Detský regál na kolieskach|home|Lupilu||Detský regál na kolieskach
Detský regál na knihy|home|Lupilu||Detský regál na knihy
Aromatický difuzér|home|||Aromatický difuzér
Papierová taška|household_cleaning|||Papierová taška
Tuhý dezodorant Zero % Rose|personal_care|Lady Speed Stick|40g|Dezodorant
Pleťová maska Black Tea & Active Charcoal|personal_care|Ellie|16ml|Pleťová maska
Pleťová maska Q10 proti vráskam|personal_care|Ellie|16ml|Pleťová maska
Bravčový bok bez kosti s kožou|meat_fish|||Bravčový bok
Bravčový bok bez kosti bez kože|meat_fish|||Bravčový bok
Bravčový bok bez kosti s kožou|meat_fish|Metro Chef||Bravčový bok
Svetlé pivo Ratar|alcohol|Radegast|500ml|Pivo
Svetlé pivo 12°|alcohol|Pilsner Urquell|6ks|Pivo
Kuchársky nôž|home|Metro Professional|1ks|Kuchársky nôž
Čistiaci prostriedok na hrnce|household_cleaning|||Čistiaci prostriedok na hrnce
Tričko|clothing|||Tričko
Polokošeľa|clothing|||Pánske oblečenie
Pulóver|clothing|||Pulóver
Rám na obraz|home|||Rám na obraz
Kaiserka natural|bakery|La Lorraine|55g|Rožky a žemle
Pivo|alcohol|Velkopopovický Kozel||Pivo
Igelitová taška s ušami|household_cleaning|Kraj||Igelitová taška s ušami
Káva zrnková Barista Caffè Crema|breakfast|Tchibo|500g|Káva
Ovocný nápoj Multivitamín|beverages|Capri-Sun|200ml|Džús a ovocný nápoj
Syr Hermelín|dairy_eggs|Král Sýrů||Camembert a hermelín
Twister čokoláda|bakery|||Sladké pečivo
Šiška s náplňou|bakery|||Sladké pečivo
Dámske ponožky|clothing||4ks|Dámske oblečenie
Dámske nohavice|clothing|||Dámske oblečenie
Vešiak|home|||Vešiak
Detské vešiaky|baby||5ks|Detské vešiaky
Teľacie párky Baby beef|deli_chilled||300g|Párky
Trhni si|deli_chilled|||Trhni si
Klobása z mangalice|deli_chilled|||Klobása
Muflónia klobása|deli_chilled|Sytno||Klobása
Sirup jahoda|beverages|Jupí|700ml|Sirup jahoda
Pepsi|beverages|Pepsi|2000ml|Limonáda
Paradajkový pretlak s bazalkou|pantry|K-Classic|700g|Paradajkový pretlak
Bravčové mäso mleté|meat_fish|K-Purland|1000g|Mleté mäso
Čokoládový dezert Modré z neba|snacks_sweets|Orion|145g|Čokoládový dezert Modré z neba
Žemľová knedľa|bakery|K-Classic|600g|Žemľová knedľa
Sushi zázvor nakladaný|pantry||190g|Sushi zázvor
Syr Camembert|dairy_eggs|K-Classic|120g|Camembert a hermelín
Mini ríbezľové paradajky|produce||250g|Paradajky
Losos údený|meat_fish|K-Classic|100g|Losos údený
Chorizo|deli_chilled||80g|Chorizo
Schwarzwaldská šunka|deli_chilled|K-Classic|100g|Šunka
Solené krekry Pom-Bär original|snacks_sweets|Pom-Bär|110g|Slané pochutiny
Plnené cherry papričky|deli_chilled|K-Favourites|150g|Plnené cherry papričky
Zmes olív|deli_chilled|K-Favourites|150g|Zmes olív
Kaiserka natural|bakery||55g|Rožky a žemle
Bageta s maslom a cesnakom|bakery||155g|Bageta
Dámska blúzka s dlhým rukávom|clothing|Tchibo||Dámske oblečenie
Detské pančuchy|clothing|Tchibo|2ks|Detské oblečenie
Dámske blúzkové tričko|clothing|Tchibo||Dámske oblečenie
Detská silikónová jedálenská súprava Compact|baby|Mykan||Detský riad
Silikónová lyžička na kŕmenie|baby|Mykan||Detský riad
Detské hryzátko Pop It 2v1|baby|Mykan||Hryzátko
Uhorky poľné|produce|||Uhorky
Sirup jahoda|beverages|Jupí||Sirup jahoda
Paradajkový pretlak|pantry|||Paradajkový pretlak
Bazalka drvená|pantry|||Bazalka drvená
Pivo Smíchov|alcohol|Staropramen||Pivo
Sýtený nápoj mandarínka|beverages|San Pellegrino||Limonáda
Mäsiarska šunka|deli_chilled|||Šunka
Dresing Tisíc ostrovov|pantry|||Dresing Tisíc ostrovov
Slané praclíky|snacks_sweets|||Slané pochutiny
Zemiakové hranolky|frozen||1000g|Zemiakové hranolky
Strúhaný syr Eidam|dairy_eggs|||Syr Eidam
Syr Eidam 30% plátky|dairy_eggs||100g|Syr Eidam
Žemľová knedľa|deli_chilled|||Žemľová knedľa
Toastový chlieb|bakery|||Chlieb
Horalky|snacks_sweets|Sedita|50g|Horalky
Vlhčené utierky kuchynské|household_cleaning|||Vlhčené utierky kuchynské
Leštidlo do umývačky riadu|household_cleaning|||Do umývačky riadu
Cherry paradajky ďatľové|produce|||Paradajky
Francúzska bageta|bakery|||Bageta
Bageta z kamennej pece|bakery|||Bageta
Jablká Cosmic Crisp|produce|||Jablká
Ľadový šalát|produce|||Šalát
Paprika červená|produce|||Paprika
Dezodorant Black|personal_care|Axe|250ml|Dezodorant
Dezodorant Excite|personal_care|Axe|150ml|Dezodorant
Probiotické kvapky Protectis|baby|BioGaia|10ml|Probiotické kvapky Protectis
Silikónový tanierik Take&Match|baby|Petite&Mars||Detský riad
Hygienické vložky|personal_care|Always|10ks|Hygienické vložky
Chladiace náplasti|health|FeverMates||Chladiace náplasti
Cottage cheese|dairy_eggs||200g|Cottage cheese
Pomarančový džús|beverages|||Džús a ovocný nápoj
Chorizo extra krájané|deli_chilled|||Chorizo
Syr Camembert Premium|dairy_eggs|||Camembert a hermelín
Toaletný papier|household_cleaning||8ks|Toaletný papier
Grécky jogurt biely|dairy_eggs|||Jogurt
Bio jogurt|dairy_eggs||150g|Jogurt
Bagetka svetlá|bakery|||Bageta
Svetlé pivo 12°|alcohol|Radegast||Pivo
Čierne korenie mleté|pantry|||Čierne korenie mleté
Potreby pre domácich majstrov|toys_hobby|||Potreby pre domácich majstrov
Svetlé pivo 12°|alcohol|Pilsner Urquell||Pivo
Toastový chlieb|bakery|Ölz|750g|Chlieb
Cesnakový uzol|bakery|Antol|75g|Cesnakový uzol
Zubná pasta|personal_care|Colgate||Zubná pasta
Jogurtová nátierka|deli_chilled|Bánovecká||Jogurtová nátierka
Dezert Tiramisu|dairy_eggs|||Dezert Tiramisu
Kaiserka natural|bakery|||Rožky a žemle
Hroznový sýtený nápoj biely|beverages|Vinea||Limonáda
Fliačky 8-vaječné|pantry|||Fliačky 8-vaječné
Podprsenka|clothing|||Dámske oblečenie
Spevňujúce telové mlieko|personal_care|Lactovit||Spevňujúce telové mlieko
Vajcia M|dairy_eggs||10ks|Vajcia
Šampiňóny|produce||500g|Šampiňóny
Polievková zmes|frozen|||Polievková zmes
Tramín červený|alcohol|||Víno
Citróny|produce|||Citróny
Maliny|produce||125g|Maliny
Paprika červená špicatá|produce|||Paprika
Mrkva|produce|||Mrkva
Cibuľka lahôdková|produce|||Cibuľka lahôdková
Svieži termizovaný syr|dairy_eggs|Lučina|180g|Svieži termizovaný syr
Sekt 1933|alcohol||750ml|Sekt 1933
Zemiakové lupienky vrúbkované pizza|snacks_sweets|Slovakia|120g|Zemiakové lupienky
Ovocné rolky malina|snacks_sweets|Bear|20g|Ovocné rolky malina
Krém na zapareniny Multi-Expert|baby|Sudocrem|400g|Krém na zapareniny Multi-Expert
Modelovacia hmota náplň|toys_hobby||4ks|Modelovacia hmota náplň
Figúrka na maľovanie s farbami|toys_hobby|||Figúrka na maľovanie s farbami
Vonný difuzér|home|||Vonný difuzér
Bryndza|dairy_eggs|Liptov||Bryndza
Kyslá smotana 16 %|dairy_eggs|||Kyslá smotana 16 %
Smotanová nátierka prírodná|dairy_eggs|||Smotanová nátierka prírodná
Syr Ementál plátky|dairy_eggs||150g|Syr Ementál plátky
Jogurt čučoriedka|dairy_eggs|||Jogurt
Tvarohovo-smotanový krém vanilka|dairy_eggs|Pribináček||Tvarohovo-smotanový krém vanilka
Bravčové párky|deli_chilled|||Párky
Detský overal|clothing|||Detské oblečenie
Wrap Crispy BBQ|dining|McDonald's||Wrap Crispy BBQ
Detské hryzátko|baby|BabyOno||Hryzátko
Drevená skladacia hračka Stardust|toys_hobby|Petite&Mars||Drevená skladacia hračka Stardust
Silikónový cumlík symetrický|baby|Canpol babies|1ks|Cumlík
Textil|clothing|||Textil
Detský repkový olej BIO|baby|babylove|250ml|Detský repkový olej BIO
Cumlík Ultra Air|baby|Avent|2ks|Cumlík
Detské chrumky malina BIO|baby|babylove|30g|Detské snacky
Detské chrumky jablko a mango|baby|babylove|30g|Detské snacky
Detské jahodové čipsy BIO|baby|babylove|12g|Detské snacky
Silikónová miska na učenie|baby|babylove|1ks|Detský riad
Plienky Premium Care 5|baby|Pampers||Plienky
Kozmetické utierky 2-vrstvové|personal_care|||Kozmetické utierky 2-vrstvové
Strúhaný kokos|pantry|||Strúhaný kokos
Limonáda mandarínka|beverages|San Pellegrino||Limonáda
Jahody sušené mrazom|snacks_sweets|||Jahody sušené mrazom
Kuchárska kniha|home|||Kuchárska kniha
Kečup jemne pálivý|pantry|Hellmann's||Kečup jemne pálivý
Detský príkrm Plus|baby|Ovko||Detský príkrm Plus
Pesto|pantry||190g|Pesto
Oblátka Horalky|snacks_sweets|Sedita||Horalky
Trstinový cukor prírodný|pantry||500g|Trstinový cukor prírodný
Bavlnený dojčenský overal s vianočným motívom|clothing|||Detské oblečenie
Bavlnené body s motýlikom|clothing|||Detské oblečenie
Kárované chino nohavice|clothing|||Pánske oblečenie
Detský overal|clothing||2ks|Detské oblečenie
Vianočný komplet s motívom Santa Clausa|clothing|||Detské oblečenie
Dátový kábel USB-C na Lightning|electronics|AlzaPower||Dátový kábel USB-C na Lightning
Kuchynská rukavica|home|||Kuchynská rukavica
Nádoba|home|||Nádoba
Detektor kovov|electronics|||Detektor kovov
Košík|home|||Košík
Dojčenská čiapka chlapčenská|clothing|||Detské oblečenie
Darčeková taška|toys_hobby|||Darčeková taška
Debrecínska pečienka|deli_chilled|||Debrecínska pečienka
Kofola Cirkulka|beverages|Kofola||Limonáda
Záloha za sklenenú fľašu|deposit|||Záloha za sklenenú fľašu
Minerálna voda jemne sýtená|beverages|Kláštorná||Minerálna voda
Svetlé pivo 10°|alcohol|Radegast||Pivo
Svetlé pivo Ratar|alcohol|Radegast||Pivo
Energetický nápoj cassis|beverages|||Energetický nápoj
Nealkoholické pivo|beverages|Staropramen||Nealkoholické pivo
Kozmetické tampóny|personal_care||280ks|Kozmetické tampóny
Syr Mozzarella mini|dairy_eggs|||Mozzarella
Ryža|pantry|Bask||Ryža
Sójová omáčka|pantry|||Sójová omáčka
Slané tyčinky|snacks_sweets||250g|Slané pochutiny
Kukurica sterilizovaná|pantry|Bonduelle||Kukurica sterilizovaná
Kyslé uhorky|pantry|||Kyslé uhorky
Šalát s koreňom|produce|||Šalát
Uhorka šalátová|produce|||Uhorky
Fitnes bagetka|bakery|||Bageta
Cesnak|produce|||Cesnak
Kuchynský pomocník|home|||Kuchynský pomocník
Chicken Junior|dining|McDonald's||Chicken Junior
Malé hranolky|dining|McDonald's||Malé hranolky
Habanero omáčka|dining|McDonald's||Habanero omáčka
Slané pečivo Maxi mix|snacks_sweets|Slovakia|100g|Slané pochutiny
Limonáda Arancia|beverages|Taliansko v srdci|1330ml|Limonáda
Limonáda Torompelmo rosa|beverages|Taliansko v srdci|1330ml|Limonáda
Nealkoholické šumivé víno De Luxe|beverages|Hubert|750ml|Nealkoholické šumivé víno De Luxe
Káva zrnková Brazília Doce Samba|breakfast|Barista Coffee Roasters|1000g|Káva
Dobierka|fees|||Dobierka
Potrubná izolácia PE|home|||Potrubná izolácia PE
Priemyselný silikónový tmel|home|||Priemyselný silikónový tmel
Univerzálny silikón|home|||Univerzálny silikón
Odstraňovač tmelu|home|||Odstraňovač tmelu
Vytláčacia pištoľ liatinová|home|Precit||Vytláčacia pištoľ liatinová
Gumová tesniaca podložka|home|||Gumová tesniaca podložka
Lepidlo a tmel Total Tech transparentné|home|Ceys||Lepidlo a tmel Total Tech transparentné
Tesnenie do regulátora|home|||Tesnenie do regulátora
Sada tesnení na vodovodné batérie|home|||Sada tesnení na vodovodné batérie
Gumové tesnenie k pripojeniu|home|||Gumové tesnenie k pripojeniu
Gombíková batéria|electronics|Varta||Batérie
Alkalické batérie AA|electronics|Varta|12ks|Batérie
Alkalické batérie AAA|electronics|Varta|12ks|Batérie
Papierová taška|other|Hornbach||Papierová taška
Benzín EVO 95|fuel|||Benzín EVO 95
Platba poistného|other|||Platba poistného
Rúško sterilné|health|Dr. Max|5ks|Rúško sterilné
Respirátor FFP2|health|Olayer|10ks|Respirátor FFP2
Pastilky Medical|health|Stopkašeľ|24ks|Pastilky Medical
Morská voda hypertonická nosový sprej|health|Dr. Max|30ml|Morská voda hypertonická nosový sprej
Univerzálna náplasť|health|Hansaplast|10ks|Univerzálna náplasť
Írska whiskey|alcohol|Jameson|700ml|Írska whiskey`;

export const RAW_RECEIPTS = `Alza|08-17||36.32|0,1,,8.19,8.19;1,1,,5.39,4.31;2,1,,6.59,6.59;3,1,,5.19,5.19;4,1,,2.79,2.37;5,1,,2.79,2.37;6,2,,5.22,7.30;7,1,,2.67,0.00
Lidl|09-09|13:48|11.21|8,1,,0.59,0.59;9,1,k,7.49,4.94;10,1,,2.99,2.99;11,1,k,2.49,1.43;12,4,,0.14,0.56;13,2,,0.35,0.70
Alza|09-10||35.87|14,1,,5.90,5.31;15,1,,16.69,16.69;16,1,,4.59,4.59;17,1,,3.79,3.79;18,1,,5.49,5.49;7,1,,1.85,0.00
Tralyco|09-10|16:10|48.25|19,1,,3.33,3.33;20,1,,2.14,2.14;21,1,,2.14,2.14;22,1,,3.21,3.21;23,1,,2.98,2.98;24,1,,2.98,2.98;25,1,,2.21,2.21;26,1,,5.59,5.59;27,1,,10.23,10.23;28,1,,2.38,2.38;29,1,,2.38,2.38;30,1,,2.38,2.38;31,1,,1.67,1.67;32,1,,1.67,1.67;33,1,,2.98,2.98
Lidl|09-13|10:08|11.50|34,1,,1.39,1.39;35,1,,9.95,9.95;36,1,,8.99,8.99;37,1,,1.25,1.25;38,1,,2.19,2.19;39,1,,1.45,1.45;40,2,,1.29,2.58;41,1,,1.89,1.89;42,1,,1.39,1.39;43,1,k,1.59,1.18;44,1,,1.49,1.49;45,4,,0.55,2.20;46,1,,-15.00,-15.00;46,1,,-1.80,-1.80;46,1,,-7.65,-7.65
dm|09-15|14:34|52.15|47,4,,2.95,11.80;48,3,,5.95,17.85;49,2,,1.25,2.50;50,2,,2.45,4.90;51,3,,2.95,8.85;52,1,,5.95,5.95;53,2,,0.15,0.30
dm|09-16|18:50|21.20|52,1,,5.95,5.95;52,1,,5.95,5.95;54,1,,0.95,0.95;54,1,,0.95,0.95;55,1,,4.95,4.95;56,1,,2.45,2.45
Róbert Gašparík|09-17|14:40|11.75|57,0,k,8.49,1.83;58,0,k,8.69,1.69;59,0,k,11.69,1.93;60,0,k,13.09,2.62;61,1,,2.29,2.29;62,1,,1.39,1.39
Alza|09-17|21:48|50.14|63,1,,34.54,29.36;64,1,,4.61,4.61;65,1,,19.09,14.32;7,1,,2.67,1.85
KiK|09-18|17:06|4.98|66,1,,1.99,1.99;67,1,,2.99,2.99
Pepco|09-18|17:20|2.04|68,1,,0.60,0.12;69,1,,0.40,0.08;69,1,,0.40,0.08;69,1,,0.40,0.08;70,1,,0.20,0.04;70,1,,0.35,0.07;70,1,,0.35,0.07;71,1,,3.00,0.60;70,1,,1.50,0.30;70,1,,1.50,0.30;72,1,,0.30,0.30
Pepco|09-18|17:31|1.08|73,1,,5.00,1.00;74,1,,0.40,0.08
Pepco|09-18|19:38|9.88|75,1,,1.90,0.38;76,1,,4.00,0.80;77,1,,0.15,0.03;78,1,,1.00,0.20;79,1,,2.20,0.44;70,1,,1.60,0.32;80,1,,0.90,0.18;81,1,,0.55,0.11;69,1,,0.40,0.08;82,1,,0.90,0.18;83,1,,0.70,0.14;81,1,,0.55,0.11;70,1,,1.60,0.32;69,1,,0.40,0.08;78,1,,1.00,0.20;72,1,,0.40,0.40;84,1,,3.30,0.66;85,1,,4.00,0.80;86,1,,3.50,0.70;87,1,,3.00,0.60;87,1,,1.90,0.38;70,1,,1.60,0.32;88,1,,1.70,0.34;89,1,,4.00,0.80;77,1,,0.15,0.03;90,1,,1.10,0.22;74,1,,0.40,0.08;74,1,,0.40,0.08;91,1,,4.50,0.90
Pepco|09-19|15:26|6.92|92,1,,0.30,0.06;93,1,,0.25,0.05;93,1,,0.25,0.05;93,1,,0.25,0.05;93,1,,0.25,0.05;93,1,,0.25,0.05;93,1,,0.25,0.05;94,1,,7.50,1.50;69,1,,0.50,0.10;95,1,,0.90,0.18;95,1,,0.90,0.18;96,1,,2.70,0.54;97,1,,4.50,0.90;81,1,,2.30,0.46;81,1,,0.90,0.90;70,1,,2.20,0.44;80,1,,1.00,0.20;98,1,,1.30,0.26;99,1,,4.50,0.90
Tesco|09-19|19:45|9.47|100,5,,1.05,5.25;101,5,,0.15,0.75;102,1,,0.87,0.87;53,1,,0.15,0.15;103,1,,2.45,2.45
Kraj|09-21|16:26|6.11|104,1,,1.99,1.99;105,1,,1.79,1.79;106,7,,0.10,0.70;107,2,,0.47,0.94;108,1,,0.69,0.69
Dr.Max|09-22||14.17|109,1,,7.49,7.49;110,1,,5.69,5.69;7,1,,0.99,0.99
Alza|09-22||17.29|111,1,,3.39,3.39;112,1,,13.90,13.90;7,1,,2.67,0.00
Slovnaft|09-22|20:35|97.18|113,2,,2.29,4.58;101,2,,0.15,0.30;114,1,,1.89,1.89;101,1,,0.15,0.15;115,45,,2.00,90.26
Lidl|09-24||27.96|116,1,,13.99,9.87;117,1,,19.99,14.10;7,1,,3.99,3.99
Pepco|09-24|11:30|8.00|118,1,,2.50,2.50;74,1,,5.00,5.00;119,1,,0.50,0.50
Teta|09-24|11:35|3.87|120,1,,1.49,1.49;121,1,,1.19,1.19;122,1,,1.19,1.19
Metro|09-24|17:20|53.39|123,1,k,5.69,6.93;123,1,k,5.69,7.11;123,1,k,5.69,7.17;123,1,k,5.99,7.14;124,1,k,5.49,7.70;125,1,k,4.29,6.53;126,6,,0.65,4.80;127,6,,0.15,0.90;128,1,,4.16,5.12
Woolworth|09-25|16:11|20.10|129,1,,1.00,1.00;130,1,,3.50,3.50;131,1,,3.00,3.00;132,1,,5.55,5.55;132,1,,5.55,5.55;133,1,,1.50,1.50
Kraj|09-25|18:08|9.36|103,1,,2.15,2.15;134,8,,0.14,1.12;135,6,,0.79,4.74;101,6,,0.15,0.90;136,1,,0.45,0.45
Kraj|09-28|15:59|21.55|137,1,,12.99,12.99;138,1,,0.65,0.65;139,1,,1.99,1.99;134,3,,0.14,0.42;140,4,,1.05,4.20;141,2,,0.65,1.30
Pepco|09-29|15:03|3.90|142,1,,0.90,0.90;143,1,,3.00,3.00
Pepco|09-29|15:16|4.50|144,1,,1.50,1.50;145,1,,1.50,1.50;145,1,,1.50,1.50
dm|09-29|15:20|3.85|50,1,,2.45,2.45;49,1,,1.25,1.25;46,1,,0.15,0.15
Farm House|09-29|16:26|26.62|146,1,,12.00,12.00;147,0,k,22.00,5.94;148,0,k,28.00,6.16;149,0,k,21.00,2.52
Kaufland|09-29|19:39|43.11|72,1,,1.09,1.09;150,1,,2.99,2.99;151,1,,1.95,1.95;53,1,,0.15,0.15;152,2,,1.49,2.98;153,1,,3.00,3.00;43,2,k,1.19,2.05;154,1,,2.74,2.74;155,1,,0.64,0.64;156,1,,1.79,1.79;157,3,,0.99,2.97;158,1,,2.39,2.39;159,1,,2.19,2.19;160,1,,1.99,1.99;161,1,,1.45,1.45;162,2,,2.99,5.98;163,1,,1.99,1.99;164,1,,1.99,1.99;165,6,,0.09,0.54;166,4,,0.56,2.24
Tchibo|09-30||21.96|167,1,,6.99,6.99;168,1,,4.99,4.99;169,1,,5.99,5.99;168,1,,3.99,3.99
MYKAN|10-02||42.20|170,1,,30.90,30.90;171,1,,4.00,4.00;172,1,,5.50,5.50;7,1,,1.80,1.80
Lidl|10-02|15:05|50.77|173,1,k,2.49,1.16;174,1,,5.99,5.99;175,1,,1.19,1.19;176,1,,0.25,0.25;177,2,,0.69,1.38;101,2,,0.15,0.30;178,1,,0.99,0.99;101,1,,0.15,0.15;179,2,,1.19,2.38;180,1,,1.99,1.99;181,1,,0.95,0.95;182,1,,1.69,1.69;9,1,k,8.99,7.73;183,2,,1.59,3.18;184,1,,0.89,0.89;185,1,,0.99,0.99;186,1,,1.09,1.09;37,1,,1.25,1.25;187,3,,0.62,1.86;188,2,,1.49,2.98;189,1,,1.39,1.39;190,1,,2.49,2.49;191,4,,0.35,1.40;192,2,,0.89,1.78;193,1,k,2.69,3.36;194,1,,1.29,1.29;195,0,k,3.79,0.67
Alza|10-05||8.33|196,1,,5.19,5.19;197,1,,3.69,3.14
Dr.Max|10-05||22.49|198,1,,17.49,17.49;199,1,,5.00,5.00
dm|10-05|16:24|13.85|200,1,,1.95,1.95;200,1,,1.95,1.95;201,1,,9.95,9.95
Lidl|10-05|16:41|14.03|202,1,,0.75,0.60;203,1,,0.31,0.31;204,1,,1.75,1.75;205,1,,1.45,1.45;206,1,,1.99,1.99;207,2,,0.49,0.98;208,2,,0.49,0.98;209,3,,0.21,0.63;13,4,,0.35,1.40;210,1,,0.92,0.92;101,1,,0.15,0.15;211,1,,0.39,0.39;187,4,,0.62,2.48
TEDi|10-05|16:51|2.00|212,1,,1.00,1.00;212,1,,1.00,1.00
KRAJ|10-06|15:27|16.28|136,1,,0.45,0.45;213,6,,1.39,8.34;46,6,,0.15,0.90;214,1,,3.95,3.95;215,2,,0.83,1.66;134,7,,0.14,0.98
Lidl|10-07|13:07|16.83|9,1,k,4.99,4.70;216,1,,1.89,1.89;217,1,,0.99,0.99;218,1,,1.59,1.59;193,1,k,2.69,2.87;43,0,k,1.59,0.73;219,6,,0.09,0.54;141,4,,0.39,1.56;208,4,,0.49,1.96
Lidl|10-09|12:51|50.68|191,2,,0.35,0.62;220,1,,1.99,1.99;53,1,,0.15,0.15;181,1,,0.95,0.95;221,2,,0.69,1.38;222,1,,3.99,3.99;205,2,,1.45,2.90;179,2,,1.19,2.38;223,1,,2.99,2.99;224,1,,2.39,2.39;225,1,,1.79,1.79;208,1,,0.49,0.49;9,1,k,7.49,4.14;183,1,,1.59,1.59;40,2,,0.99,1.98;39,1,,1.45,1.45;187,2,,0.62,1.24;203,1,,0.31,0.31;226,1,,2.99,2.99;227,1,,3.99,3.99;35,1,,9.95,9.95;184,2,,0.69,1.38;228,0,k,2.99,0.75;44,1,,1.49,1.49;141,4,,0.39,1.56;229,1,,1.89,1.89;230,0,k,2.99,0.41;231,0,k,1.39,0.20;232,1,,0.69,0.69;11,0,k,2.49,0.76;42,1,,0.89,0.89;46,1,,-9.00,-9.00
Tesco|10-10|20:08|24.43|233,1,,2.79,2.79;234,1,,11.99,11.99;100,6,,1.05,6.30;101,6,,0.15,0.90;235,1,,2.45,2.45
Dr.Max|10-13||18.87|236,1,,0.76,0.76;199,1,,4.28,4.28;7,1,,0.99,0.99;237,1,,12.84,12.84
Pepco|10-13|13:59|12.00|238,1,,2.00,2.00;239,1,,1.00,1.00;240,1,,3.00,3.00;240,1,,3.00,3.00;240,1,,3.00,3.00
Lidl|10-13|14:17|36.99|222,2,,3.99,7.98;222,1,,3.99,3.99;186,1,,1.09,1.09;190,1,,2.39,2.39;241,1,,1.65,1.65;242,1,,0.55,0.55;243,1,,0.99,0.99;208,3,,0.49,1.47;244,1,,1.15,1.15;204,1,,1.75,1.75;245,2,,0.44,0.88;246,3,,0.49,1.47;247,1,,1.99,1.99;40,1,,1.29,1.29;248,1,,3.99,3.99;43,1,k,1.59,1.14;219,8,,0.09,0.72;13,4,,0.35,1.40;45,2,,0.55,1.10
McDonald's|10-14|17:36|5.10|249,1,,5.10,5.10
feedo.sk|10-15||10.85|250,1,,0.95,0.95;250,1,,0.95,0.95;251,1,,5.95,5.95;252,1,,3.00,3.00
Feedo|10-15||8.00|253,1,,3.00,3.00;253,1,,3.00,3.00;253,1,,2.00,2.00
dm|10-15|15:46|50.75|254,1,,2.95,2.95;72,1,,1.25,1.25;48,1,,5.95,5.95;255,1,,4.45,4.45;254,1,,2.95,2.95;47,1,,2.95,2.95;48,1,,5.95,5.95;47,1,,2.95,2.95;47,1,,2.95,2.95;51,1,,2.95,2.95;51,1,,2.95,2.95;50,1,,2.45,2.45;256,1,,1.00,1.00;50,1,,2.45,2.45;257,1,,1.00,1.00;258,1,,1.65,1.65;259,1,,3.95,3.95
Lidl|10-15|16:20|49.92|260,1,,9.99,7.99;43,1,k,1.29,0.88;37,2,,1.25,2.50;203,1,,0.31,0.31;261,1,,1.09,1.09;262,1,,1.45,1.45;188,1,,1.49,1.49;263,1,,1.19,1.19;101,1,,0.15,0.15;264,1,,2.29,2.29;265,1,,5.99,5.99;266,1,,2.49,2.49;9,1,k,7.49,4.89;267,1,,1.89,1.89;175,1,,1.19,1.19;268,2,,1.39,2.78;208,2,,0.49,0.98;269,1,,2.29,2.29;41,1,,1.69,1.69;270,1,,0.99,0.99;219,5,,0.09,0.45;141,4,,0.39,1.56;229,1,,1.89,1.89;232,1,,0.89,0.89;11,0,k,1.29,0.61
LPP|10-16||41.33|271,1,,5.49,5.49;271,1,,5.49,5.49;272,1,,3.99,3.99;272,1,,3.99,3.99;273,1,,6.39,6.39;274,1,,7.99,7.99;275,1,,7.99,7.99
Alza|10-16||12.51|276,1,,13.90,12.51;7,1,,1.85,0.00
Pepco|10-17|13:53|21.00|277,1,,1.50,1.50;277,1,,1.50,1.50;72,1,,0.40,0.40;278,1,,2.00,2.00;278,1,,2.00,2.00;279,1,,3.00,3.00;280,1,,2.00,2.00;280,1,,3.00,3.00;281,1,,1.30,1.30;282,1,,1.30,1.30;282,1,,1.00,1.00;282,1,,1.00,1.00;282,1,,1.00,1.00
Róbert Gašparík|10-17|14:02|3.83|283,0,k,12.99,3.83
Lidl|10-17|14:33|55.74|228,0,k,2.49,0.77;194,1,,1.59,1.43;42,1,,0.99,0.89;284,1,,1.15,1.15;285,1,,0.30,0.30;286,1,,0.69,0.69;53,1,,0.15,0.15;210,3,,0.92,2.76;101,3,,0.15,0.45;287,1,,0.85,0.85;101,1,,0.15,0.15;288,1,,0.79,0.79;101,1,,0.15,0.15;289,1,,0.59,0.59;101,1,,0.15,0.15;290,4,,0.89,3.56;101,4,,0.15,0.60;291,1,,1.95,1.95;181,1,,0.95,0.95;208,2,,0.49,0.98;292,2,,0.99,1.98;293,1,,1.69,1.69;9,1,k,7.49,5.88;294,2,,1.09,2.18;267,1,,1.89,1.89;246,4,,0.49,1.96;204,2,,1.75,3.50;295,1,,0.74,0.74;205,1,,1.45,1.45;296,1,,1.09,1.09;297,1,,1.05,1.05;203,1,,0.31,0.31;225,1,,1.79,1.79;186,1,,1.09,1.09;269,1,,2.29,2.29;298,1,,1.99,1.99;299,1,,0.99,0.99;231,0,k,1.29,0.31;300,3,,0.24,0.72;192,2,,0.89,1.78;232,1,,0.89,0.89;301,0,k,4.90,0.86
TEDi|10-17|14:41|3.00|302,1,,1.00,1.00;302,1,,1.00,1.00;302,1,,1.00,1.00
McDonald's|10-17|17:39|8.80|303,1,,2.90,2.90;304,1,,1.00,1.00;303,1,,2.90,2.90;304,1,,1.00,1.00;305,1,,1.00,1.00
Tesco|10-18|13:38|25.90|306,1,,1.95,1.95;114,6,,1.29,7.74;101,6,,0.15,0.90;307,1,,2.15,2.15;53,1,,0.15,0.15;308,1,,2.15,2.15;53,1,,0.15,0.15;103,1,,1.72,1.72;309,1,,8.99,8.99
Barista coffee roasters|10-19||27.50|310,1,,23.50,23.50;7,1,,2.80,2.80;311,1,,1.20,1.20
Hornbach|10-19|16:21|43.52|312,1,,1.20,1.20;313,1,,5.09,5.09;314,1,,5.63,5.63;315,1,,4.83,4.83;316,1,,3.64,3.64;317,0,k,81.56,1.55;318,1,,5.49,5.49;319,1,,0.46,0.46;320,1,,1.95,1.95;321,1,,0.64,0.64;322,3,,1.55,4.65;323,1,,3.95,3.95;324,1,,3.95,3.95;325,1,,0.49,0.49
Slovnaft|10-19|16:39|81.36|326,44,,1.87,81.36
KOOPERATIVA|10-20|09:21|58.47|327,1,,58.47,58.47
Dr.Max|10-21||13.80|328,1,,1.99,1.99;328,1,,1.99,1.99;7,1,,0.99,0.99;329,1,,2.89,2.89;330,1,,5.94,5.94
Dr.Max|10-21||10.07|331,1,,7.99,7.99;332,1,,1.09,1.09;7,1,,0.99,0.99
Kaufland|10-21|20:45|19.79|333,1,,18.49,18.49;114,1,,1.15,1.15;101,1,,0.15,0.15`;
