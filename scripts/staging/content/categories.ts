import type { CategoryContent } from "./types";

// All categories keyed by their CURRENT en slug. en slugs stay unchanged;
// sr/de/es get localized slugs (SlugHistory records the retired ones).

export const categories: Record<string, CategoryContent> = {
  // ── Electronics ────────────────────────────────────────────────────────────
  electronics: {
    names: { en: "Electronics", sr: "Elektronika", de: "Elektronik", es: "Electrónica" },
    slugs: { en: "electronics", sr: "elektronika", de: "elektronik", es: "electronica" },
    desc: {
      en: "Laptops, phones, TVs, cameras and smart devices from leading brands.",
      sr: "Laptopovi, telefoni, televizori, kamere i pametni uređaji vodećih brendova.",
      de: "Laptops, Smartphones, Fernseher, Kameras und smarte Geräte führender Marken.",
      es: "Portátiles, teléfonos, televisores, cámaras y dispositivos inteligentes de las mejores marcas.",
    },
  },
  "laptops-computers": {
    names: { en: "Laptops & Computers", sr: "Laptopi i računari", de: "Laptops & Computer", es: "Portátiles y ordenadores" },
    slugs: { en: "laptops-computers", sr: "laptopi-i-racunari", de: "laptops-computer", es: "portatiles-y-ordenadores" },
    desc: {
      en: "Ultrabooks, gaming laptops, desktops and workstations for every budget.",
      sr: "Ultrabook računari, gejming laptopovi, desktop računari i radne stanice za svaki budžet.",
      de: "Ultrabooks, Gaming-Laptops, Desktops und Workstations für jedes Budget.",
      es: "Ultrabooks, portátiles gaming, sobremesas y estaciones de trabajo para todos los bolsillos.",
    },
  },
  "smartphones-tablets": {
    names: { en: "Smartphones & Tablets", sr: "Pametni telefoni i tableti", de: "Smartphones & Tablets", es: "Smartphones y tabletas" },
    slugs: { en: "smartphones-tablets", sr: "pametni-telefoni-i-tableti", de: "smartphones-tablets", es: "smartphones-y-tabletas" },
    desc: {
      en: "Flagship and budget phones, tablets and foldables with the latest features.",
      sr: "Vodeći i pristupačni telefoni, tableti i preklopni uređaji sa najnovijim funkcijama.",
      de: "Flaggschiff- und Budget-Handys, Tablets und Foldables mit den neuesten Funktionen.",
      es: "Móviles insignia y económicos, tabletas y plegables con las últimas funciones.",
    },
  },
  "tv-audio": {
    names: { en: "TV & Audio", sr: "TV i audio", de: "TV & Audio", es: "TV y audio" },
    slugs: { en: "tv-audio", sr: "tv-i-audio", de: "tv-audio", es: "tv-y-audio" },
    desc: {
      en: "OLED and 4K TVs, soundbars, speakers and headphones for home cinema and music.",
      sr: "OLED i 4K televizori, soundbar sistemi, zvučnici i slušalice za kućni bioskop i muziku.",
      de: "OLED- und 4K-Fernseher, Soundbars, Lautsprecher und Kopfhörer für Heimkino und Musik.",
      es: "Televisores OLED y 4K, barras de sonido, altavoces y auriculares para cine en casa y música.",
    },
  },
  "cameras-photography": {
    names: { en: "Cameras & Photography", sr: "Kamere i fotografija", de: "Kameras & Fotografie", es: "Cámaras y fotografía" },
    slugs: { en: "cameras-photography", sr: "kamere-i-fotografija", de: "kameras-fotografie", es: "camaras-y-fotografia" },
    desc: {
      en: "Mirrorless and DSLR cameras, action cams and gear for creators at every level.",
      sr: "Mirrorless i DSLR kamere, akcione kamere i oprema za kreatore svih nivoa.",
      de: "Spiegellose und DSLR-Kameras, Actioncams und Zubehör für Kreative jeder Stufe.",
      es: "Cámaras sin espejo y réflex, cámaras de acción y equipo para creadores de todos los niveles.",
    },
  },
  gaming: {
    names: { en: "Gaming", sr: "Gejming", de: "Gaming", es: "Gaming" },
    slugs: { en: "gaming", sr: "gejming", de: "gaming", es: "gaming" },
    desc: {
      en: "Consoles, controllers, headsets and keyboards for every kind of player.",
      sr: "Konzole, kontroleri, slušalice i tastature za svaku vrstu igrača.",
      de: "Konsolen, Controller, Headsets und Tastaturen für jede Art von Spieler.",
      es: "Consolas, mandos, auriculares y teclados para todo tipo de jugadores.",
    },
  },
  "smart-home": {
    names: { en: "Smart Home", sr: "Pametni dom", de: "Smart Home", es: "Hogar inteligente" },
    slugs: { en: "smart-home", sr: "pametni-dom", de: "smart-home", es: "hogar-inteligente" },
    desc: {
      en: "Smart lighting, security and voice assistants that make your home work for you.",
      sr: "Pametna rasveta, sigurnosni uređaji i glasovni asistenti koji čine da dom radi za vas.",
      de: "Smarte Beleuchtung, Sicherheit und Sprachassistenten, die Ihr Zuhause für Sie arbeiten lassen.",
      es: "Iluminación inteligente, seguridad y asistentes de voz que ponen tu casa a trabajar para ti.",
    },
  },
  // ── Fashion ────────────────────────────────────────────────────────────────
  fashion: {
    names: { en: "Fashion", sr: "Moda", de: "Mode", es: "Moda" },
    slugs: { en: "fashion", sr: "moda", de: "mode", es: "moda" },
    desc: {
      en: "Clothing, shoes and accessories for men, women and kids - from basics to statement pieces.",
      sr: "Odeća, obuća i aksesoari za muškarce, žene i decu - od osnovnih do upečatljivih komada.",
      de: "Kleidung, Schuhe und Accessoires für Damen, Herren und Kinder - von Basics bis zu Statement-Pieces.",
      es: "Ropa, calzado y accesorios para hombre, mujer y niños - de los básicos a las piezas con carácter.",
    },
  },
  "mens-clothing": {
    names: { en: "Men's Clothing", sr: "Muška odeća", de: "Herrenbekleidung", es: "Ropa de hombre" },
    slugs: { en: "mens-clothing", sr: "muska-odeca", de: "herrenbekleidung", es: "ropa-de-hombre" },
    desc: {
      en: "Shirts, jeans, knitwear and tailoring for the modern man's wardrobe.",
      sr: "Košulje, farmerke, pletenina i sakoi za garderober savremenog muškarca.",
      de: "Hemden, Jeans, Strick und Sakkos für die Garderobe des modernen Mannes.",
      es: "Camisas, vaqueros, punto y sastrería para el armario del hombre moderno.",
    },
  },
  "womens-clothing": {
    names: { en: "Women's Clothing", sr: "Ženska odeća", de: "Damenbekleidung", es: "Ropa de mujer" },
    slugs: { en: "womens-clothing", sr: "zenska-odeca", de: "damenbekleidung", es: "ropa-de-mujer" },
    desc: {
      en: "Dresses, blouses, denim and outerwear - effortless style for every occasion.",
      sr: "Haljine, bluze, teksas i gornji slojevi - stil bez napora za svaku priliku.",
      de: "Kleider, Blusen, Denim und Jacken - müheloser Stil für jeden Anlass.",
      es: "Vestidos, blusas, denim y abrigos - estilo sin esfuerzo para cada ocasión.",
    },
  },
  "kids-clothing": {
    names: { en: "Kids' Clothing", sr: "Dečija odeća", de: "Kinderbekleidung", es: "Ropa infantil" },
    slugs: { en: "kids-clothing", sr: "decija-odeca", de: "kinderbekleidung", es: "ropa-infantil" },
    desc: {
      en: "Durable, comfortable clothes that keep up with kids at play.",
      sr: "Izdržljiva, udobna odeća koja prati decu u igri.",
      de: "Robuste, bequeme Kleidung, die beim Spielen mithält.",
      es: "Ropa resistente y cómoda que sigue el ritmo de los niños en el juego.",
    },
  },
  shoes: {
    names: { en: "Shoes", sr: "Obuća", de: "Schuhe", es: "Calzado" },
    slugs: { en: "shoes", sr: "obuca", de: "schuhe", es: "calzado" },
    desc: {
      en: "Sneakers, boots and everyday footwear that balance comfort and style.",
      sr: "Patike, čizme i svakodnevna obuća koja balansira udobnost i stil.",
      de: "Sneaker, Stiefel und Alltagsschuhe, die Komfort und Stil vereinen.",
      es: "Zapatillas, botas y calzado diario que equilibran comodidad y estilo.",
    },
  },
  "bags-accessories": {
    names: { en: "Bags & Accessories", sr: "Torbe i dodaci", de: "Taschen & Accessoires", es: "Bolsos y accesorios" },
    slugs: { en: "bags-accessories", sr: "torbe-i-dodaci", de: "taschen-accessoires", es: "bolsos-y-accesorios" },
    desc: {
      en: "Backpacks, totes, wallets and the details that finish an outfit.",
      sr: "Ranci, tote torbe, novčanici i detalji koji zaokružuju kombinaciju.",
      de: "Rucksäcke, Shopper, Geldbörsen und die Details, die ein Outfit vollenden.",
      es: "Mochilas, bolsos tote, carteras y los detalles que rematan un conjunto.",
    },
  },
  "jewelry-watches": {
    names: { en: "Jewelry & Watches", sr: "Nakit i satovi", de: "Schmuck & Uhren", es: "Joyas y relojes" },
    slugs: { en: "jewelry-watches", sr: "nakit-i-satovi", de: "schmuck-uhren", es: "joyas-y-relojes" },
    desc: {
      en: "Timepieces and jewelry for gifts, milestones and everyday sparkle.",
      sr: "Satovi i nakit za poklone, važne trenutke i svakodnevni sjaj.",
      de: "Uhren und Schmuck für Geschenke, Meilensteine und den Glanz im Alltag.",
      es: "Relojes y joyas para regalos, ocasiones especiales y el brillo de cada día.",
    },
  },
  // ── Home & Garden ──────────────────────────────────────────────────────────
  "home-garden": {
    names: { en: "Home & Garden", sr: "Dom i bašta", de: "Haus & Garten", es: "Hogar y jardín" },
    slugs: { en: "home-garden", sr: "dom-i-basta", de: "haus-garten", es: "hogar-y-jardin" },
    desc: {
      en: "Furniture, kitchenware, decor and everything that turns a house into a home.",
      sr: "Nameštaj, kuhinjsko posuđe, dekoracija i sve što kuću pretvara u dom.",
      de: "Möbel, Küchenutensilien, Deko und alles, was ein Haus zum Zuhause macht.",
      es: "Muebles, menaje, decoración y todo lo que convierte una casa en un hogar.",
    },
  },
  furniture: {
    names: { en: "Furniture", sr: "Nameštaj", de: "Möbel", es: "Muebles" },
    slugs: { en: "furniture", sr: "namestaj", de: "moebel", es: "muebles" },
    desc: {
      en: "Sofas, tables, chairs and storage built for real life.",
      sr: "Sofe, stolovi, stolice i odlaganje građeni za stvarni život.",
      de: "Sofas, Tische, Stühle und Stauraum - gebaut für das echte Leben.",
      es: "Sofás, mesas, sillas y almacenaje hechos para la vida real.",
    },
  },
  "kitchen-dining": {
    names: { en: "Kitchen & Dining", sr: "Kuhinja i trpezarija", de: "Küche & Esszimmer", es: "Cocina y comedor" },
    slugs: { en: "kitchen-dining", sr: "kuhinja-i-trpezarija", de: "kueche-esszimmer", es: "cocina-y-comedor" },
    desc: {
      en: "Cookware, appliances and tableware for cooks of every ambition.",
      sr: "Posuđe za kuvanje, aparati i servisi za kuvare svih ambicija.",
      de: "Kochgeschirr, Geräte und Geschirr für Köche jeder Ambition.",
      es: "Utensilios de cocina, electrodomésticos y vajillas para cocineros de toda ambición.",
    },
  },
  "bedding-bath": {
    names: { en: "Bedding & Bath", sr: "Posteljina i kupatilo", de: "Bettwaren & Bad", es: "Ropa de cama y baño" },
    slugs: { en: "bedding-bath", sr: "posteljina-i-kupatilo", de: "bettwaren-bad", es: "ropa-de-cama-y-bano" },
    desc: {
      en: "Soft bedding, towels and bath essentials for better mornings and nights.",
      sr: "Mekana posteljina, peškiri i kupatilske potrepštine za bolja jutra i noći.",
      de: "Weiche Bettwaren, Handtücher und Bad-Essentials für bessere Morgen und Nächte.",
      es: "Ropa de cama suave, toallas y básicos de baño para mejores mañanas y noches.",
    },
  },
  "home-decor": {
    names: { en: "Home Decor", sr: "Dekoracija doma", de: "Wohndeko", es: "Decoración del hogar" },
    slugs: { en: "home-decor", sr: "dekoracija-doma", de: "wohndeko", es: "decoracion-del-hogar" },
    desc: {
      en: "Rugs, wall art, candles and accents that give rooms personality.",
      sr: "Tepisi, zidne dekoracije, sveće i detalji koji prostorijama daju karakter.",
      de: "Teppiche, Wandkunst, Kerzen und Akzente, die Räumen Persönlichkeit geben.",
      es: "Alfombras, arte de pared, velas y detalles que dan personalidad a las habitaciones.",
    },
  },
  "garden-outdoor": {
    names: { en: "Garden & Outdoor", sr: "Bašta i eksterijer", de: "Garten & Außenbereich", es: "Jardín y exterior" },
    slugs: { en: "garden-outdoor", sr: "basta-i-eksterijer", de: "garten-aussenbereich", es: "jardin-y-exterior" },
    desc: {
      en: "Outdoor furniture, tools and gear for gardens, balconies and terraces.",
      sr: "Baštenski nameštaj, alat i oprema za bašte, balkone i terase.",
      de: "Gartenmöbel, Werkzeuge und Ausstattung für Garten, Balkon und Terrasse.",
      es: "Muebles de exterior, herramientas y equipo para jardines, balcones y terrazas.",
    },
  },
  lighting: {
    names: { en: "Lighting", sr: "Rasveta", de: "Beleuchtung", es: "Iluminación" },
    slugs: { en: "lighting", sr: "rasveta", de: "beleuchtung", es: "iluminacion" },
    desc: {
      en: "Lamps, pendants and smart bulbs that set the mood in every room.",
      sr: "Lampe, visilice i pametne sijalice koje stvaraju atmosferu u svakoj prostoriji.",
      de: "Lampen, Pendelleuchten und smarte Glühbirnen, die in jedem Raum Stimmung schaffen.",
      es: "Lámparas, colgantes y bombillas inteligentes que crean ambiente en cada habitación.",
    },
  },
  // ── Sports & Outdoors ──────────────────────────────────────────────────────
  "sports-outdoors": {
    names: { en: "Sports & Outdoors", sr: "Sport i rekreacija", de: "Sport & Outdoor", es: "Deportes y aire libre" },
    slugs: { en: "sports-outdoors", sr: "sport-i-rekreacija", de: "sport-outdoor", es: "deportes-y-aire-libre" },
    desc: {
      en: "Fitness equipment, outdoor gear and sportswear for active lives.",
      sr: "Fitnes oprema, oprema za prirodu i sportska odeća za aktivan život.",
      de: "Fitnessgeräte, Outdoor-Ausrüstung und Sportbekleidung für ein aktives Leben.",
      es: "Equipamiento de fitness, material outdoor y ropa deportiva para vidas activas.",
    },
  },
  "exercise-fitness": {
    names: { en: "Exercise & Fitness", sr: "Vežbanje i fitnes", de: "Fitness & Training", es: "Ejercicio y fitness" },
    slugs: { en: "exercise-fitness", sr: "vezbanje-i-fitnes", de: "fitness-training", es: "ejercicio-y-fitness" },
    desc: {
      en: "Weights, mats, bands and recovery tools for home and gym workouts.",
      sr: "Tegovi, prostirke, trake i alati za oporavak za treninge kod kuće i u teretani.",
      de: "Gewichte, Matten, Bänder und Recovery-Tools für Training zu Hause und im Studio.",
      es: "Pesas, esterillas, bandas y herramientas de recuperación para entrenar en casa y en el gimnasio.",
    },
  },
  "outdoor-recreation": {
    names: { en: "Outdoor Recreation", sr: "Rekreacija na otvorenom", de: "Outdoor & Camping", es: "Recreación al aire libre" },
    slugs: { en: "outdoor-recreation", sr: "rekreacija-na-otvorenom", de: "outdoor-camping", es: "recreacion-al-aire-libre" },
    desc: {
      en: "Tents, backpacks and camping gear for adventures big and small.",
      sr: "Šatori, ranci i oprema za kampovanje za velike i male avanture.",
      de: "Zelte, Rucksäcke und Campingausrüstung für große und kleine Abenteuer.",
      es: "Tiendas, mochilas y equipo de acampada para aventuras grandes y pequeñas.",
    },
  },
  "team-sports": {
    names: { en: "Team Sports", sr: "Ekipni sportovi", de: "Mannschaftssport", es: "Deportes de equipo" },
    slugs: { en: "team-sports", sr: "ekipni-sportovi", de: "mannschaftssport", es: "deportes-de-equipo" },
    desc: {
      en: "Balls, kits and training equipment for football, basketball and more.",
      sr: "Lopte, dresovi i oprema za trening za fudbal, košarku i još mnogo toga.",
      de: "Bälle, Trikots und Trainingsausrüstung für Fußball, Basketball und mehr.",
      es: "Balones, equipaciones y material de entrenamiento para fútbol, baloncesto y más.",
    },
  },
  cycling: {
    names: { en: "Cycling", sr: "Biciklizam", de: "Radsport", es: "Ciclismo" },
    slugs: { en: "cycling", sr: "biciklizam", de: "radsport", es: "ciclismo" },
    desc: {
      en: "Bikes, helmets and accessories for commuting, trails and road rides.",
      sr: "Bicikli, kacige i dodaci za gradsku vožnju, staze i drumske ture.",
      de: "Fahrräder, Helme und Zubehör für Pendelstrecken, Trails und Rennradtouren.",
      es: "Bicicletas, cascos y accesorios para ir al trabajo, senderos y salidas de carretera.",
    },
  },
  "water-sports": {
    names: { en: "Water Sports", sr: "Vodeni sportovi", de: "Wassersport", es: "Deportes acuáticos" },
    slugs: { en: "water-sports", sr: "vodeni-sportovi", de: "wassersport", es: "deportes-acuaticos" },
    desc: {
      en: "Gear for swimming, paddling and everything on or under the water.",
      sr: "Oprema za plivanje, veslanje i sve na vodi ili pod njom.",
      de: "Ausrüstung fürs Schwimmen, Paddeln und alles auf und unter dem Wasser.",
      es: "Equipo para nadar, remar y todo lo que pasa sobre o bajo el agua.",
    },
  },
  // ── Books & Media ──────────────────────────────────────────────────────────
  "books-media": {
    names: { en: "Books & Media", sr: "Knjige i mediji", de: "Bücher & Medien", es: "Libros y medios" },
    slugs: { en: "books-media", sr: "knjige-i-mediji", de: "buecher-medien", es: "libros-y-medios" },
    desc: {
      en: "Books, music, movies and games for readers, listeners and players.",
      sr: "Knjige, muzika, filmovi i igre za čitaoce, slušaoce i igrače.",
      de: "Bücher, Musik, Filme und Spiele für Leser, Hörer und Spieler.",
      es: "Libros, música, películas y juegos para lectores, oyentes y jugadores.",
    },
  },
  books: {
    names: { en: "Books", sr: "Knjige", de: "Bücher", es: "Libros" },
    slugs: { en: "books", sr: "knjige", de: "buecher", es: "libros" },
    desc: {
      en: "Fiction, non-fiction and professional titles worth shelf space.",
      sr: "Beletristika, publicistika i stručni naslovi vredni mesta na polici.",
      de: "Belletristik, Sachbücher und Fachtitel, die den Regalplatz wert sind.",
      es: "Ficción, no ficción y títulos profesionales que merecen sitio en la estantería.",
    },
  },
  music: {
    names: { en: "Music", sr: "Muzika", de: "Musik", es: "Música" },
    slugs: { en: "music", sr: "muzika", de: "musik", es: "musica" },
    desc: {
      en: "Vinyl, CDs and music merchandise for every genre and generation.",
      sr: "Vinil, CD izdanja i muzički artikli za svaki žanr i generaciju.",
      de: "Vinyl, CDs und Musik-Merchandise für jedes Genre und jede Generation.",
      es: "Vinilos, CDs y merchandising musical para cada género y generación.",
    },
  },
  "movies-tv": {
    names: { en: "Movies & TV", sr: "Filmovi i TV", de: "Filme & Serien", es: "Películas y TV" },
    slugs: { en: "movies-tv", sr: "filmovi-i-tv", de: "filme-serien", es: "peliculas-y-tv" },
    desc: {
      en: "Blu-rays, box sets and collector editions for movie nights.",
      sr: "Blu-ray izdanja, kolekcije i kolekcionarska izdanja za filmske večeri.",
      de: "Blu-rays, Boxsets und Sammlereditionen für Filmabende.",
      es: "Blu-rays, packs y ediciones de coleccionista para las noches de cine.",
    },
  },
  "video-games": {
    names: { en: "Video Games", sr: "Video igre", de: "Videospiele", es: "Videojuegos" },
    slugs: { en: "video-games", sr: "video-igre", de: "videospiele", es: "videojuegos" },
    desc: {
      en: "New releases and classics for PlayStation, Xbox, PC and Switch.",
      sr: "Nova izdanja i klasici za PlayStation, Xbox, PC i Switch.",
      de: "Neuerscheinungen und Klassiker für PlayStation, Xbox, PC und Switch.",
      es: "Novedades y clásicos para PlayStation, Xbox, PC y Switch.",
    },
  },
  // ── Health & Beauty ────────────────────────────────────────────────────────
  "health-beauty": {
    names: { en: "Health & Beauty", sr: "Zdravlje i lepota", de: "Gesundheit & Beauty", es: "Salud y belleza" },
    slugs: { en: "health-beauty", sr: "zdravlje-i-lepota", de: "gesundheit-beauty", es: "salud-y-belleza" },
    desc: {
      en: "Skincare, fragrance and wellness essentials for daily routines.",
      sr: "Nega kože, mirisi i wellness potrepštine za svakodnevne rutine.",
      de: "Hautpflege, Düfte und Wellness-Essentials für die tägliche Routine.",
      es: "Cuidado de la piel, fragancias y básicos de bienestar para la rutina diaria.",
    },
  },
  skincare: {
    names: { en: "Skincare", sr: "Nega kože", de: "Hautpflege", es: "Cuidado de la piel" },
    slugs: { en: "skincare", sr: "nega-koze", de: "hautpflege", es: "cuidado-de-la-piel" },
    desc: {
      en: "Serums, creams and sunscreens that keep skin healthy and glowing.",
      sr: "Serumi, kreme i zaštita od sunca koji kožu drže zdravom i blistavom.",
      de: "Seren, Cremes und Sonnenschutz, die die Haut gesund und strahlend halten.",
      es: "Sérums, cremas y protectores solares que mantienen la piel sana y radiante.",
    },
  },
  "hair-care": {
    names: { en: "Hair Care", sr: "Nega kose", de: "Haarpflege", es: "Cuidado del cabello" },
    slugs: { en: "hair-care", sr: "nega-kose", de: "haarpflege", es: "cuidado-del-cabello" },
    desc: {
      en: "Shampoos, treatments and styling for every hair type.",
      sr: "Šamponi, tretmani i stilizovanje za svaki tip kose.",
      de: "Shampoos, Kuren und Styling für jeden Haartyp.",
      es: "Champús, tratamientos y peinado para todo tipo de cabello.",
    },
  },
  "vitamins-supplements": {
    names: { en: "Vitamins & Supplements", sr: "Vitamini i suplementi", de: "Vitamine & Nahrungsergänzung", es: "Vitaminas y suplementos" },
    slugs: { en: "vitamins-supplements", sr: "vitamini-i-suplementi", de: "vitamine-nahrungsergaenzung", es: "vitaminas-y-suplementos" },
    desc: {
      en: "Daily vitamins, minerals and sports nutrition to support your goals.",
      sr: "Dnevni vitamini, minerali i sportska ishrana kao podrška vašim ciljevima.",
      de: "Tägliche Vitamine, Mineralstoffe und Sportnahrung zur Unterstützung Ihrer Ziele.",
      es: "Vitaminas diarias, minerales y nutrición deportiva para apoyar tus objetivos.",
    },
  },
  "personal-care": {
    names: { en: "Personal Care", sr: "Lična higijena", de: "Körperpflege", es: "Cuidado personal" },
    slugs: { en: "personal-care", sr: "licna-higijena", de: "koerperpflege", es: "cuidado-personal" },
    desc: {
      en: "Grooming and hygiene essentials for the whole family.",
      sr: "Osnovna sredstva za negu i higijenu za celu porodicu.",
      de: "Pflege- und Hygiene-Essentials für die ganze Familie.",
      es: "Básicos de aseo e higiene para toda la familia.",
    },
  },
  fragrances: {
    names: { en: "Fragrances", sr: "Parfemi", de: "Düfte", es: "Perfumes" },
    slugs: { en: "fragrances", sr: "parfemi", de: "duefte", es: "perfumes" },
    desc: {
      en: "Perfumes and colognes from fresh daily scents to evening signatures.",
      sr: "Parfemi i kolonjske vode - od svežih dnevnih do prepoznatljivih večernjih mirisa.",
      de: "Parfums und Colognes - von frischen Alltagsdüften bis zu abendlichen Signaturen.",
      es: "Perfumes y colonias, de aromas frescos diarios a firmas de noche.",
    },
  },
  // ── Toys & Kids ────────────────────────────────────────────────────────────
  "toys-kids": {
    names: { en: "Toys & Kids", sr: "Igračke i deca", de: "Spielzeug & Kinder", es: "Juguetes y niños" },
    slugs: { en: "toys-kids", sr: "igracke-i-deca", de: "spielzeug-kinder", es: "juguetes-y-ninos" },
    desc: {
      en: "Toys, games and baby essentials that spark play and learning.",
      sr: "Igračke, igre i potrepštine za bebe koje podstiču igru i učenje.",
      de: "Spielzeug, Spiele und Baby-Essentials, die Spielen und Lernen anregen.",
      es: "Juguetes, juegos y básicos de bebé que despiertan el juego y el aprendizaje.",
    },
  },
  "toys-games": {
    names: { en: "Toys & Games", sr: "Igračke i igre", de: "Spielzeug & Spiele", es: "Juguetes y juegos" },
    slugs: { en: "toys-games", sr: "igracke-i-igre", de: "spielzeug-spiele", es: "juguetes-y-juegos" },
    desc: {
      en: "Building sets, board games and toys for all ages.",
      sr: "Setovi za građenje, društvene igre i igračke za sve uzraste.",
      de: "Bausets, Brettspiele und Spielzeug für alle Altersgruppen.",
      es: "Sets de construcción, juegos de mesa y juguetes para todas las edades.",
    },
  },
  "baby-toddler": {
    names: { en: "Baby & Toddler", sr: "Bebe i mala deca", de: "Baby & Kleinkind", es: "Bebés y niños pequeños" },
    slugs: { en: "baby-toddler", sr: "bebe-i-mala-deca", de: "baby-kleinkind", es: "bebes-y-ninos-pequenos" },
    desc: {
      en: "Strollers, sensory toys and gear for the first years.",
      sr: "Kolica, senzorne igračke i oprema za prve godine.",
      de: "Kinderwagen, Sensorikspielzeug und Ausstattung für die ersten Jahre.",
      es: "Sillas de paseo, juguetes sensoriales y equipo para los primeros años.",
    },
  },
  educational: {
    names: { en: "Educational", sr: "Edukativne igračke", de: "Lernspielzeug", es: "Educativos" },
    slugs: { en: "educational", sr: "edukativne-igracke", de: "lernspielzeug", es: "educativos" },
    desc: {
      en: "STEM kits and learning toys that make curiosity fun.",
      sr: "STEM kompleti i edukativne igračke koje radoznalost čine zabavnom.",
      de: "MINT-Kits und Lernspielzeug, das Neugier zum Vergnügen macht.",
      es: "Kits STEM y juguetes educativos que convierten la curiosidad en diversión.",
    },
  },
  "arts-crafts": {
    names: { en: "Arts & Crafts", sr: "Umetnost i kreativnost", de: "Basteln & Kreatives", es: "Arte y manualidades" },
    slugs: { en: "arts-crafts", sr: "umetnost-i-kreativnost", de: "basteln-kreatives", es: "arte-y-manualidades" },
    desc: {
      en: "Paints, paper and craft kits for rainy-day creativity.",
      sr: "Boje, papir i kreativni kompleti za stvaralaštvo kad pada kiša.",
      de: "Farben, Papier und Bastelsets für Kreativität an Regentagen.",
      es: "Pinturas, papel y kits de manualidades para la creatividad en días de lluvia.",
    },
  },
  // ── Automotive ─────────────────────────────────────────────────────────────
  automotive: {
    names: { en: "Automotive", sr: "Auto-moto", de: "Auto & Motorrad", es: "Automoción" },
    slugs: { en: "automotive", sr: "auto-moto", de: "auto-motorrad", es: "automocion" },
    desc: {
      en: "Car electronics, tools and care products for drivers and DIY mechanics.",
      sr: "Auto elektronika, alati i sredstva za negu za vozače i majstore amatere.",
      de: "Auto-Elektronik, Werkzeuge und Pflegeprodukte für Fahrer und Hobbyschrauber.",
      es: "Electrónica del coche, herramientas y productos de cuidado para conductores y mecánicos aficionados.",
    },
  },
  "car-electronics": {
    names: { en: "Car Electronics", sr: "Auto elektronika", de: "Auto-Elektronik", es: "Electrónica para el coche" },
    slugs: { en: "car-electronics", sr: "auto-elektronika", de: "auto-elektronik", es: "electronica-para-el-coche" },
    desc: {
      en: "Dash cams, adapters and audio upgrades for any vehicle.",
      sr: "Auto kamere, adapteri i audio nadogradnje za svako vozilo.",
      de: "Dashcams, Adapter und Audio-Upgrades für jedes Fahrzeug.",
      es: "Cámaras de salpicadero, adaptadores y mejoras de audio para cualquier vehículo.",
    },
  },
  "parts-accessories": {
    names: { en: "Parts & Accessories", sr: "Delovi i dodaci", de: "Teile & Zubehör", es: "Piezas y accesorios" },
    slugs: { en: "parts-accessories", sr: "delovi-i-dodaci", de: "teile-zubehoer", es: "piezas-y-accesorios" },
    desc: {
      en: "Replacement parts and practical accessories for everyday driving.",
      sr: "Rezervni delovi i praktični dodaci za svakodnevnu vožnju.",
      de: "Ersatzteile und praktisches Zubehör für den Fahralltag.",
      es: "Piezas de repuesto y accesorios prácticos para la conducción diaria.",
    },
  },
  "tools-equipment": {
    names: { en: "Tools & Equipment", sr: "Alati i oprema", de: "Werkzeug & Ausrüstung", es: "Herramientas y equipo" },
    slugs: { en: "tools-equipment", sr: "alati-i-oprema", de: "werkzeug-ausruestung", es: "herramientas-y-equipo" },
    desc: {
      en: "Drills, wrench sets and workshop gear for projects big and small.",
      sr: "Bušilice, setovi ključeva i radionička oprema za velike i male projekte.",
      de: "Bohrmaschinen, Schlüsselsätze und Werkstattausrüstung für große und kleine Projekte.",
      es: "Taladros, juegos de llaves y equipo de taller para proyectos grandes y pequeños.",
    },
  },
  "car-care-cleaning": {
    names: { en: "Care & Cleaning", sr: "Pranje i održavanje", de: "Pflege & Reinigung", es: "Cuidado y limpieza" },
    slugs: { en: "car-care-cleaning", sr: "pranje-i-odrzavanje", de: "pflege-reinigung", es: "cuidado-y-limpieza" },
    desc: {
      en: "Waxes, cleaners and detailing kits that keep cars looking new.",
      sr: "Voskovi, sredstva za čišćenje i kompleti za detailing koji auto drže kao nov.",
      de: "Wachse, Reiniger und Detailing-Kits, die Autos wie neu aussehen lassen.",
      es: "Ceras, limpiadores y kits de detailing que mantienen el coche como nuevo.",
    },
  },
};
