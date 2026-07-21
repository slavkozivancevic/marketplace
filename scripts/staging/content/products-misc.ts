import type { ProductContent } from "./types";

// Books, video games, health & beauty, toys and baby.

export const misc: Record<string, ProductContent> = {
  "the-pragmatic-developer": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "The Pragmatic Developer",
        short: "A practical guide to building software that lasts - from naming things to shipping them.",
        desc: "Twenty years of hard-won lessons distilled into one readable volume: how to name things, when to refactor, why simple beats clever and how to ship without burning out. Each chapter closes with exercises you can apply to the codebase you maintain today. A book developers gift to their younger selves.",
      },
      sr: {
        title: "Pragmatični programer",
        short: "Praktičan vodič za pravljenje softvera koji traje - od imenovanja do isporuke.",
        desc: "Dvadeset godina teško stečenih lekcija sažeto u jedan čitljiv tom: kako imenovati stvari, kada refaktorisati, zašto jednostavno pobeđuje pametno i kako isporučivati bez sagorevanja. Svako poglavlje završava vežbama primenljivim na kod koji već danas održavate. Knjiga koju programeri poklanjaju mlađem sebi.",
      },
      de: {
        title: "Der pragmatische Entwickler",
        short: "Ein praktischer Leitfaden für Software, die Bestand hat - vom Benennen bis zum Ausliefern.",
        desc: "Zwanzig Jahre hart erarbeiteter Lektionen, destilliert in einen lesbaren Band: wie man Dinge benennt, wann man refaktoriert, warum einfach klug schlägt und wie man liefert, ohne auszubrennen. Jedes Kapitel endet mit Übungen für die Codebasis, die Sie heute betreuen. Ein Buch, das Entwickler ihrem jüngeren Ich schenken.",
      },
      es: {
        title: "El desarrollador pragmático",
        short: "Una guía práctica para construir software que perdura - desde nombrar las cosas hasta publicarlas.",
        desc: "Veinte años de lecciones duramente aprendidas destiladas en un volumen legible: cómo nombrar las cosas, cuándo refactorizar, por qué lo simple vence a lo ingenioso y cómo publicar sin quemarse. Cada capítulo termina con ejercicios aplicables al código que mantienes hoy. Un libro que los desarrolladores regalan a su yo más joven.",
      },
    },
  },
  "atomic-habits": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Atomic Habits",
        short: "The bestselling framework for building good habits and breaking bad ones, one percent at a time.",
        desc: "Small changes, remarkable results: this bestseller shows why habits stick when systems replace goals, how to design your environment so the good choice becomes the easy one, and how one percent daily improvements compound into transformation. Practical, evidence-based and genuinely useful from chapter one.",
      },
      sr: {
        title: "Atomske navike",
        short: "Bestseler okvir za građenje dobrih i razbijanje loših navika, procenat po procenat.",
        desc: "Male promene, izuzetni rezultati: ovaj bestseler pokazuje zašto se navike primaju kada sistemi zamene ciljeve, kako da uredite okruženje da dobar izbor postane lak izbor i kako se dnevna poboljšanja od jednog procenta slažu u preobražaj. Praktično, zasnovano na dokazima i zaista korisno od prvog poglavlja.",
      },
      de: {
        title: "Atomic Habits",
        short: "Das Bestseller-Konzept, um gute Gewohnheiten aufzubauen und schlechte abzulegen - ein Prozent nach dem anderen.",
        desc: "Kleine Veränderungen, bemerkenswerte Ergebnisse: Dieser Bestseller zeigt, warum Gewohnheiten halten, wenn Systeme Ziele ersetzen, wie man seine Umgebung so gestaltet, dass die gute Wahl zur leichten wird, und wie sich tägliche Ein-Prozent-Verbesserungen zu einer Verwandlung aufsummieren. Praktisch, evidenzbasiert und ab Kapitel eins wirklich nützlich.",
      },
      es: {
        title: "Hábitos atómicos",
        short: "El método superventas para crear buenos hábitos y romper los malos, un uno por ciento cada vez.",
        desc: "Pequeños cambios, resultados extraordinarios: este superventas muestra por qué los hábitos arraigan cuando los sistemas sustituyen a las metas, cómo diseñar tu entorno para que la buena elección sea la fácil y cómo las mejoras diarias del uno por ciento se acumulan hasta transformarte. Práctico, basado en evidencia y útil de verdad desde el primer capítulo.",
      },
    },
  },
  "clean-architecture": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Clean Architecture",
        short: "A software architect's guide to structures that survive changing requirements and frameworks.",
        desc: "Frameworks come and go - good boundaries stay. This guide teaches the architectural principles behind systems that welcome change: dependency rules, component boundaries and the discipline of keeping business logic independent of databases, frameworks and user interfaces. Essential reading for anyone who owns a codebase.",
      },
      sr: {
        title: "Čista arhitektura",
        short: "Vodič softverskog arhitekte za strukture koje preživljavaju promene zahteva i frejmvorka.",
        desc: "Frejmvorci dolaze i prolaze - dobre granice ostaju. Ovaj vodič uči arhitektonske principe sistema koji rado prihvataju promene: pravila zavisnosti, granice komponenti i disciplinu držanja poslovne logike nezavisnom od baza, frejmvorka i korisničkih interfejsa. Obavezno štivo za svakoga ko vodi neki kod.",
      },
      de: {
        title: "Clean Architecture",
        short: "Der Leitfaden des Softwarearchitekten für Strukturen, die wechselnde Anforderungen und Frameworks überleben.",
        desc: "Frameworks kommen und gehen - gute Grenzen bleiben. Dieser Leitfaden vermittelt die Architekturprinzipien hinter Systemen, die Veränderung begrüßen: Abhängigkeitsregeln, Komponentengrenzen und die Disziplin, Geschäftslogik unabhängig von Datenbanken, Frameworks und Benutzeroberflächen zu halten. Pflichtlektüre für alle, die eine Codebasis verantworten.",
      },
      es: {
        title: "Arquitectura limpia",
        short: "La guía del arquitecto de software para estructuras que sobreviven a requisitos y frameworks cambiantes.",
        desc: "Los frameworks van y vienen - los buenos límites permanecen. Esta guía enseña los principios arquitectónicos de los sistemas que aceptan el cambio: reglas de dependencia, fronteras entre componentes y la disciplina de mantener la lógica de negocio independiente de bases de datos, frameworks e interfaces. Lectura esencial para quien es dueño de un código.",
      },
    },
  },
  "cooking-basics": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Cooking Basics",
        short: "An illustrated course in fundamental techniques - 100 recipes every home cook should master.",
        desc: "Learn to cook, not just follow recipes: step-by-step photography teaches knife skills, five mother sauces, perfect rice and the roast chicken worth repeating every Sunday. All 100 recipes use supermarket ingredients and explain why each step matters, so improvising becomes second nature.",
      },
      sr: {
        title: "Osnove kuvanja",
        short: "Ilustrovani kurs osnovnih tehnika - 100 recepata koje svaki domaći kuvar treba da savlada.",
        desc: "Naučite da kuvate, ne samo da pratite recepte: fotografije korak po korak uče rad sa nožem, pet osnovnih sosova, savršen pirinač i pečeno pile vredno ponavljanja svake nedelje. Svih 100 recepata koristi namirnice iz obične prodavnice i objašnjava zašto je svaki korak bitan, pa improvizacija postaje druga priroda.",
      },
      de: {
        title: "Grundlagen des Kochens",
        short: "Ein bebilderter Kurs in Grundtechniken - 100 Rezepte, die jeder Hobbykoch beherrschen sollte.",
        desc: "Kochen lernen statt nur Rezepten folgen: Schritt-für-Schritt-Fotografie vermittelt Messertechnik, fünf Grundsaucen, perfekten Reis und das Brathähnchen, das jeden Sonntag wert ist. Alle 100 Rezepte nutzen Supermarkt-Zutaten und erklären, warum jeder Schritt zählt - so wird Improvisieren zur zweiten Natur.",
      },
      es: {
        title: "Fundamentos de cocina",
        short: "Un curso ilustrado de técnicas fundamentales - 100 recetas que todo cocinero casero debería dominar.",
        desc: "Aprende a cocinar, no solo a seguir recetas: la fotografía paso a paso enseña el manejo del cuchillo, las cinco salsas madre, el arroz perfecto y el pollo asado que repetirás cada domingo. Las 100 recetas usan ingredientes de supermercado y explican por qué importa cada paso, para que improvisar se vuelva algo natural.",
      },
    },
  },
  "open-world-rpg": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "platform",
      options: [
        { value: "playstation", priceFactor: 1, stock: 24 },
        { value: "xbox", priceFactor: 1, stock: 18 },
        { value: "pc", priceFactor: 0.85, stock: 30 },
      ],
    },
    t: {
      en: {
        title: "Open World RPG",
        short: "A vast open-world role-playing epic with over 120 hours of quests and consequences.",
        desc: "A living world that reacts to every choice: forge alliances or betray them, clear dungeons your own way and watch towns change based on what you did three chapters ago. Over 120 hours of hand-crafted quests, a branching story with meaningful endings and a photo mode you will lose evenings to.",
      },
      sr: {
        title: "Open World RPG",
        short: "Ogroman open-world RPG ep sa preko 120 sati zadataka i posledica.",
        desc: "Živi svet koji reaguje na svaki izbor: sklapajte saveze ili ih izdajte, čistite tamnice na svoj način i gledajte kako se gradovi menjaju zbog onoga što ste uradili pre tri poglavlja. Preko 120 sati ručno rađenih zadataka, razgranata priča sa smislenim završecima i foto režim uz koji ćete gubiti večeri.",
      },
      de: {
        title: "Open World RPG",
        short: "Ein riesiges Open-World-Rollenspiel-Epos mit über 120 Stunden an Quests und Konsequenzen.",
        desc: "Eine lebendige Welt, die auf jede Entscheidung reagiert: Schmieden Sie Bündnisse oder brechen Sie sie, räumen Sie Verliese auf Ihre Art und sehen Sie zu, wie sich Städte verändern - wegen dem, was Sie vor drei Kapiteln taten. Über 120 Stunden handgefertigter Quests, eine verzweigte Geschichte mit bedeutsamen Enden und ein Fotomodus, an den Sie Abende verlieren werden.",
      },
      es: {
        title: "RPG de mundo abierto",
        short: "Una épica de rol de mundo abierto con más de 120 horas de misiones y consecuencias.",
        desc: "Un mundo vivo que reacciona a cada decisión: forja alianzas o traiciónalas, limpia mazmorras a tu manera y observa cómo cambian las ciudades por lo que hiciste tres capítulos atrás. Más de 120 horas de misiones hechas a mano, una historia ramificada con finales con peso y un modo foto al que perderás tardes enteras.",
      },
    },
  },
  "racing-sim-2026": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "platform",
      options: [
        { value: "playstation", priceFactor: 1, stock: 20 },
        { value: "xbox", priceFactor: 1, stock: 16 },
        { value: "pc", priceFactor: 0.9, stock: 26 },
      ],
    },
    t: {
      en: {
        title: "Racing Sim 2026",
        short: "The definitive racing simulation: 300 cars, laser-scanned tracks and living weather.",
        desc: "Every bump of the curbs, every drop of rain on the visor: Racing Sim 2026 laser-scans 40 legendary tracks and models 300 cars down to tire flex and brake fade. Dynamic weather and day-night cycles turn every race into a story, and crossplay multiplayer fills grids day and night.",
      },
      sr: {
        title: "Racing Sim 2026",
        short: "Definitivna trkačka simulacija: 300 automobila, laserski skenirane staze i živo vreme.",
        desc: "Svaka neravnina ivičnjaka, svaka kap kiše na viziru: Racing Sim 2026 laserski skenira 40 legendarnih staza i modeluje 300 automobila do savijanja gume i slabljenja kočnica. Dinamično vreme i smena dana i noći svaku trku pretvaraju u priču, a crossplay multiplayer puni grid danju i noću.",
      },
      de: {
        title: "Racing Sim 2026",
        short: "Die definitive Rennsimulation: 300 Autos, lasergescannte Strecken und lebendiges Wetter.",
        desc: "Jede Unebenheit der Curbs, jeder Regentropfen auf dem Visier: Racing Sim 2026 lasert 40 legendäre Strecken ein und modelliert 300 Autos bis hin zu Reifenflex und Bremsfading. Dynamisches Wetter und Tag-Nacht-Zyklen machen jedes Rennen zur Geschichte, und Crossplay-Multiplayer füllt die Startaufstellung rund um die Uhr.",
      },
      es: {
        title: "Racing Sim 2026",
        short: "La simulación de carreras definitiva: 300 coches, circuitos escaneados por láser y clima vivo.",
        desc: "Cada resalto de los pianos, cada gota de lluvia en la visera: Racing Sim 2026 escanea por láser 40 circuitos legendarios y modela 300 coches hasta la flexión del neumático y la fatiga de frenos. El clima dinámico y los ciclos de día y noche convierten cada carrera en una historia, y el multijugador crossplay llena las parrillas a todas horas.",
      },
    },
  },
  "hydrating-serum": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "volume",
      options: [
        { value: "30ml", priceFactor: 1, stock: 26 },
        { value: "50ml", priceFactor: 1.5, stock: 18 },
      ],
    },
    t: {
      en: {
        title: "Hydrating Serum",
        short: "Lightweight hyaluronic serum that plumps skin with 72-hour hydration - fragrance-free.",
        desc: "Three weights of hyaluronic acid sink into different skin depths, drawing in moisture that lasts up to 72 hours. The featherweight, fragrance-free formula layers invisibly under moisturizer and makeup, leaving skin plumper and fine lines softened. Suitable for sensitive skin, tested by dermatologists.",
      },
      sr: {
        title: "Hidratantni serum",
        short: "Lagani hijaluronski serum koji popunjava kožu hidratacijom do 72 sata - bez mirisa.",
        desc: "Tri težine hijaluronske kiseline upijaju se u različite dubine kože i privlače vlagu koja traje do 72 sata. Peronežna formula bez mirisa nevidljivo se slaže ispod kreme i šminke, ostavljajući kožu popunjenijom, a fine linije ublaženim. Pogodan za osetljivu kožu, dermatološki testiran.",
      },
      de: {
        title: "Feuchtigkeitsserum",
        short: "Leichtes Hyaluronserum, das die Haut mit 72-Stunden-Feuchtigkeit aufpolstert - parfümfrei.",
        desc: "Drei Molekülgrößen Hyaluronsäure dringen in unterschiedliche Hauttiefen ein und binden Feuchtigkeit für bis zu 72 Stunden. Die federleichte, parfümfreie Formel legt sich unsichtbar unter Creme und Make-up, polstert die Haut auf und mildert feine Linien. Für empfindliche Haut geeignet, dermatologisch getestet.",
      },
      es: {
        title: "Sérum hidratante",
        short: "Sérum ligero de ácido hialurónico que rellena la piel con hidratación de 72 horas - sin perfume.",
        desc: "Tres pesos de ácido hialurónico penetran a distintas profundidades de la piel, atrayendo una hidratación que dura hasta 72 horas. La fórmula ligerísima y sin perfume se aplica invisible bajo la crema y el maquillaje, dejando la piel más jugosa y las líneas finas suavizadas. Apto para piel sensible, testado dermatológicamente.",
      },
    },
  },
  "vitamin-c-cream": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "volume",
      options: [
        { value: "50ml", priceFactor: 1, stock: 30 },
        { value: "100ml", priceFactor: 1.6, stock: 12 },
      ],
    },
    t: {
      en: {
        title: "Vitamin C Cream",
        short: "Brightening day cream with stabilized vitamin C that evens tone and defends against city air.",
        desc: "Wake up your complexion: stabilized vitamin C brightens and gradually evens tone, while niacinamide strengthens the skin barrier against pollution and dry office air. The silky cream absorbs fast enough for morning routines, wears well under sunscreen and never pills under makeup.",
      },
      sr: {
        title: "Krema sa vitaminom C",
        short: "Posvetljujuća dnevna krema sa stabilizovanim vitaminom C koja ujednačava ten i brani od gradskog vazduha.",
        desc: "Probudite svoj ten: stabilizovani vitamin C posvetljuje i postepeno ujednačava ton, dok niacinamid jača kožnu barijeru protiv zagađenja i suvog kancelarijskog vazduha. Svilenkasta krema upija se dovoljno brzo za jutarnju rutinu, dobro stoji ispod kreme za sunčanje i nikada se ne roluje ispod šminke.",
      },
      de: {
        title: "Vitamin-C-Creme",
        short: "Aufhellende Tagescreme mit stabilisiertem Vitamin C, die den Teint ausgleicht und vor Stadtluft schützt.",
        desc: "Wecken Sie Ihren Teint: Stabilisiertes Vitamin C hellt auf und gleicht den Hautton nach und nach aus, während Niacinamid die Hautbarriere gegen Abgase und trockene Büroluft stärkt. Die seidige Creme zieht schnell genug für die Morgenroutine ein, hält unter Sonnenschutz und krümelt nie unter Make-up.",
      },
      es: {
        title: "Crema con vitamina C",
        short: "Crema de día iluminadora con vitamina C estabilizada que unifica el tono y defiende del aire urbano.",
        desc: "Despierta tu cutis: la vitamina C estabilizada ilumina y unifica el tono gradualmente, mientras la niacinamida refuerza la barrera cutánea frente a la contaminación y el aire seco de la oficina. La crema sedosa se absorbe a tiempo para la rutina matinal, se lleva bien bajo el protector solar y nunca hace grumos con el maquillaje.",
      },
    },
  },
  "spf-50-sunscreen": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "volume",
      options: [
        { value: "100ml", priceFactor: 1, stock: 40 },
        { value: "200ml", priceFactor: 1.7, stock: 16 },
      ],
    },
    t: {
      en: {
        title: "SPF 50 Sunscreen",
        short: "Invisible SPF 50 sunscreen with no white cast - light enough to wear every single day.",
        desc: "The sunscreen you will actually use daily: broad-spectrum SPF 50 in a weightless gel-cream that disappears on every skin tone with zero white cast. It doubles as a smoothing makeup base, resists sweat for 80 minutes and leaves none of the greasy film that makes people skip sun protection.",
      },
      sr: {
        title: "SPF 50 zaštita od sunca",
        short: "Nevidljiva SPF 50 krema bez belih tragova - dovoljno lagana za svaki dan.",
        desc: "Krema za sunčanje koju ćete zaista koristiti svakodnevno: širokospektralni SPF 50 u bestežinskoj gel-kremi koja nestaje na svakom tenu bez belih tragova. Služi i kao izglađujuća podloga za šminku, odoleva znoju 80 minuta i ne ostavlja mastan film zbog kojeg ljudi preskaču zaštitu od sunca.",
      },
      de: {
        title: "Sonnencreme LSF 50",
        short: "Unsichtbarer Sonnenschutz mit LSF 50 ohne weißen Film - leicht genug für jeden Tag.",
        desc: "Die Sonnencreme, die Sie wirklich täglich benutzen: Breitband-LSF 50 in einer schwerelosen Gel-Creme, die auf jedem Hautton ohne weißen Schleier verschwindet. Sie funktioniert auch als glättende Make-up-Basis, hält Schweiß 80 Minuten stand und hinterlässt keinen fettigen Film - den Grund, aus dem viele den Sonnenschutz auslassen.",
      },
      es: {
        title: "Protector solar SPF 50",
        short: "Protector solar SPF 50 invisible sin rastro blanco - tan ligero que lo usarás a diario.",
        desc: "El protector que de verdad usarás cada día: SPF 50 de amplio espectro en una gel-crema ingrávida que desaparece en todos los tonos de piel sin dejar rastro blanco. Funciona como base alisadora de maquillaje, resiste el sudor 80 minutos y no deja esa película grasa por la que la gente se salta la protección solar.",
      },
    },
  },
  "eau-de-parfum-noir": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "volume",
      options: [
        { value: "50ml", priceFactor: 1, stock: 20 },
        { value: "100ml", priceFactor: 1.6, stock: 10 },
      ],
    },
    t: {
      en: {
        title: "Eau de Parfum Noir",
        short: "A magnetic evening fragrance of black pepper, leather and smoked vanilla.",
        desc: "Noir opens with a spark of black pepper and bergamot, settles into a heart of leather and iris, and lingers on skin as smoked vanilla and cedar. An evening fragrance with genuine presence - two sprays last from dinner past midnight. Comes in a weighty glass flacon worth keeping on display.",
      },
      sr: {
        title: "Eau de Parfum Noir",
        short: "Magnetičan večernji miris crnog bibera, kože i dimljene vanile.",
        desc: "Noir se otvara varnicom crnog bibera i bergamota, smiruje u srcu od kože i irisa, a na koži ostaje kao dimljena vanila i kedar. Večernji miris sa istinskim prisustvom - dva raspršivanja traju od večere do posle ponoći. Stiže u teškoj staklenoj bočici koju vredi držati na vidnom mestu.",
      },
      de: {
        title: "Eau de Parfum Noir",
        short: "Ein magnetischer Abendduft aus schwarzem Pfeffer, Leder und geräucherter Vanille.",
        desc: "Noir eröffnet mit einem Funken schwarzen Pfeffers und Bergamotte, findet sein Herz in Leder und Iris und bleibt auf der Haut als geräucherte Vanille und Zeder. Ein Abendduft mit echter Präsenz - zwei Sprühstöße reichen vom Abendessen bis nach Mitternacht. Im gewichtigen Glasflakon, der auf dem Regal bleiben darf.",
      },
      es: {
        title: "Eau de Parfum Noir",
        short: "Una fragancia nocturna magnética de pimienta negra, cuero y vainilla ahumada.",
        desc: "Noir abre con una chispa de pimienta negra y bergamota, se asienta en un corazón de cuero e iris y permanece en la piel como vainilla ahumada y cedro. Una fragancia de noche con verdadera presencia - dos pulverizaciones duran de la cena hasta pasada la medianoche. Llega en un frasco de cristal con peso que merece quedarse a la vista.",
      },
    },
  },
  "fresh-citrus-cologne": {
    brand: null,
    variants: {
      mode: "options",
      attrKey: "volume",
      options: [
        { value: "100ml", priceFactor: 1, stock: 22 },
        { value: "200ml", priceFactor: 1.5, stock: 9 },
      ],
    },
    t: {
      en: {
        title: "Fresh Citrus Cologne",
        short: "A sparkling everyday cologne of Sicilian lemon, neroli and sea breeze.",
        desc: "Bottled morning light: Sicilian lemon and grapefruit burst first, neroli and a saline sea-breeze accord carry the day, and a whisper of white musk keeps it close to the skin. Effortless and office-safe, it is the cologne you reach for daily from April to October.",
      },
      sr: {
        title: "Sveža citrus kolonjska",
        short: "Iskričava svakodnevna kolonjska voda sicilijanskog limuna, nerolija i morskog povetarca.",
        desc: "Jutarnja svetlost u bočici: sicilijanski limun i grejpfrut prasnu prvi, neroli i slani akord morskog povetarca nose dan, a šapat belog mošusa drži ga uz kožu. Neusiljena i prikladna za kancelariju, ovo je kolonjska za kojom posežete svakodnevno od aprila do oktobra.",
      },
      de: {
        title: "Frisches Zitrus-Cologne",
        short: "Ein spritziges Alltags-Cologne aus sizilianischer Zitrone, Neroli und Meeresbrise.",
        desc: "Morgenlicht in der Flasche: Sizilianische Zitrone und Grapefruit sprühen zuerst, Neroli und ein salziger Meeresbrise-Akkord tragen durch den Tag, und ein Hauch weißer Moschus hält alles hautnah. Unangestrengt und bürotauglich - das Cologne, zu dem man von April bis Oktober täglich greift.",
      },
      es: {
        title: "Colonia cítrica fresca",
        short: "Una colonia diaria chispeante de limón siciliano, neroli y brisa marina.",
        desc: "Luz de la mañana embotellada: el limón siciliano y el pomelo estallan primero, el neroli y un acorde salino de brisa marina sostienen el día, y un susurro de almizcle blanco lo mantiene pegado a la piel. Natural y apta para la oficina, es la colonia que eliges a diario de abril a octubre.",
      },
    },
  },
  "building-bricks-1000pc": {
    brand: "lego",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Building Bricks 1000pc",
        short: "1000 colorful building bricks compatible with all major brands - imagination included.",
        desc: "A thousand bricks, infinite builds: this creative box mixes classic bricks, plates, wheels, windows and eyes in a rainbow of colors, all compatible with the bricks already scattered around your home. The included idea booklet kickstarts ten builds, and the storage tub makes cleanup a two-minute game.",
      },
      sr: {
        title: "Kocke za slaganje 1000 delova",
        short: "1000 šarenih kockica kompatibilnih sa svim velikim brendovima - mašta uključena.",
        desc: "Hiljadu kockica, beskrajne gradnje: ova kreativna kutija meša klasične kocke, pločice, točkove, prozore i oči u dugi boja, sve kompatibilno sa kockama koje se već valjaju po vašem domu. Priložena knjižica ideja pokreće deset gradnji, a kutija za odlaganje pretvara pospremanje u igru od dva minuta.",
      },
      de: {
        title: "Bausteine 1000 Teile",
        short: "1000 bunte Bausteine, kompatibel mit allen großen Marken - Fantasie inklusive.",
        desc: "Tausend Steine, unendliche Bauten: Diese Kreativbox mischt klassische Steine, Platten, Räder, Fenster und Augen in einem Farbenregenbogen - alles kompatibel mit den Steinen, die schon bei Ihnen zu Hause herumliegen. Das beiliegende Ideenheft startet zehn Bauprojekte, und die Aufbewahrungsbox macht das Aufräumen zum Zwei-Minuten-Spiel.",
      },
      es: {
        title: "Bloques de construcción 1000 piezas",
        short: "1000 bloques de colores compatibles con todas las grandes marcas - imaginación incluida.",
        desc: "Mil piezas, construcciones infinitas: esta caja creativa mezcla bloques clásicos, placas, ruedas, ventanas y ojos en un arcoíris de colores, todo compatible con las piezas que ya ruedan por tu casa. El folleto de ideas incluido arranca diez construcciones, y la caja de almacenaje convierte la recogida en un juego de dos minutos.",
      },
    },
  },
  "wooden-train-set": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Wooden Train Set",
        short: "Classic 45-piece wooden railway with magnetic trains, bridges and trees - ages 3+.",
        desc: "The toy that outlives trends: 45 pieces of beech-wood track, magnetic trains, a bridge, a tunnel and little trees build a world that three generations can play in together. Finished with child-safe water-based paints and compatible with the wooden railway systems grandparents already own.",
      },
      sr: {
        title: "Drveni voz set",
        short: "Klasična drvena železnica od 45 delova sa magnetnim vozićima, mostovima i drvećem - 3+.",
        desc: "Igračka koja nadživljava trendove: 45 delova bukove pruge, magnetni vozići, most, tunel i malo drveće grade svet u kojem se tri generacije igraju zajedno. Završena bojama na vodenoj bazi bezbednim za decu i kompatibilna sa drvenim železnicama koje bake i deke već imaju.",
      },
      de: {
        title: "Holzeisenbahn-Set",
        short: "Klassische Holzeisenbahn mit 45 Teilen, Magnetzügen, Brücken und Bäumen - ab 3 Jahren.",
        desc: "Das Spielzeug, das Trends überdauert: 45 Teile Buchenholzschienen, Magnetzüge, eine Brücke, ein Tunnel und kleine Bäume bauen eine Welt, in der drei Generationen gemeinsam spielen. Mit kindersicheren Farben auf Wasserbasis lackiert und kompatibel mit den Holzeisenbahnen, die Großeltern schon besitzen.",
      },
      es: {
        title: "Tren de madera",
        short: "Ferrocarril clásico de madera de 45 piezas con trenes magnéticos, puentes y árboles - a partir de 3 años.",
        desc: "El juguete que sobrevive a las modas: 45 piezas de vía de madera de haya, trenes magnéticos, un puente, un túnel y arbolitos construyen un mundo en el que juegan juntas tres generaciones. Acabado con pinturas al agua seguras para niños y compatible con los ferrocarriles de madera que los abuelos ya tienen.",
      },
    },
  },
  "board-game-night": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Board Game Night",
        short: "A fast-learning strategy party game for 2-6 players - rounds of 30 riotous minutes.",
        desc: "The game that ends phone-scrolling at gatherings: learn it in five minutes, master it over months. Two to six players race to build routes, block rivals and bluff their way to victory in rounds of about thirty minutes. Quality components - linen-finish cards and wooden pieces - survive years of game nights.",
      },
      sr: {
        title: "Društvena igra",
        short: "Brzo naučiva strateška igra za 2-6 igrača - partije od 30 urnebesnih minuta.",
        desc: "Igra koja prekida skrolovanje telefona na okupljanjima: nauči se za pet minuta, savladava mesecima. Dva do šest igrača trkaju se da grade puteve, blokiraju protivnike i bluframa stignu do pobede u partijama od tridesetak minuta. Kvalitetne komponente - karte sa platnenom završnicom i drvene figure - preživljavaju godine igračkih večeri.",
      },
      de: {
        title: "Brettspiel-Abend",
        short: "Ein schnell erlerntes Strategie-Partyspiel für 2-6 Spieler - Runden von 30 turbulenten Minuten.",
        desc: "Das Spiel, das das Handy-Scrollen bei Treffen beendet: in fünf Minuten gelernt, über Monate gemeistert. Zwei bis sechs Spieler wetteifern darum, Routen zu bauen, Rivalen zu blockieren und sich zum Sieg zu bluffen - in Runden von etwa dreißig Minuten. Hochwertige Komponenten - Karten mit Leinenprägung und Holzfiguren - überstehen Jahre von Spieleabenden.",
      },
      es: {
        title: "Noche de juegos de mesa",
        short: "Un juego de estrategia para fiestas, fácil de aprender, de 2 a 6 jugadores - partidas de 30 minutos de risas.",
        desc: "El juego que acaba con el móvil en las reuniones: se aprende en cinco minutos y se domina en meses. De dos a seis jugadores compiten por construir rutas, bloquear rivales y farolear hasta la victoria en partidas de una media hora. Componentes de calidad - cartas con acabado de lino y piezas de madera - que aguantan años de noches de juegos.",
      },
    },
  },
  "remote-control-car": {
    brand: "lego",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Remote Control Car",
        short: "All-terrain RC car with proportional steering, 25 km/h top speed and a one-hour battery.",
        desc: "Driveway, park or gravel path - the all-terrain RC car takes them all at up to 25 km/h. Proportional steering teaches real car control instead of jerky lurches, the oversized tires soak up curbs and roots, and one charge delivers a full hour of driving. Two cars can race on separate channels.",
      },
      sr: {
        title: "Auto na daljinski",
        short: "Terenski auto na daljinsko upravljanje sa proporcionalnim skretanjem, brzinom do 25 km/h i baterijom od sat vremena.",
        desc: "Prilaz, park ili šljunkovita staza - terenski auto na daljinski savladava sve do 25 km/h. Proporcionalno skretanje uči pravu kontrolu vozila umesto trzavih pokreta, prevelike gume gutaju ivičnjake i korenje, a jedno punjenje daje pun sat vožnje. Dva auta mogu da se trkaju na odvojenim kanalima.",
      },
      de: {
        title: "Ferngesteuertes Auto",
        short: "Allterrain-RC-Auto mit Proportionallenkung, 25 km/h Spitze und einer Stunde Akkulaufzeit.",
        desc: "Einfahrt, Park oder Schotterweg - das Allterrain-RC-Auto nimmt alles mit bis zu 25 km/h. Die Proportionallenkung lehrt echte Fahrzeugkontrolle statt ruckartiger Schlenker, die übergroßen Reifen schlucken Bordsteine und Wurzeln, und eine Ladung reicht für eine volle Stunde Fahrspaß. Zwei Autos fahren auf getrennten Kanälen um die Wette.",
      },
      es: {
        title: "Coche teledirigido",
        short: "Coche RC todoterreno con dirección proporcional, 25 km/h de velocidad máxima y una hora de batería.",
        desc: "Entrada de casa, parque o camino de grava - el coche RC todoterreno puede con todo hasta a 25 km/h. La dirección proporcional enseña control de verdad en lugar de bandazos, los neumáticos sobredimensionados absorben bordillos y raíces, y una carga da una hora completa de conducción. Dos coches pueden competir en canales separados.",
      },
    },
  },
  "soft-activity-cube": {
    brand: null,
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Soft Activity Cube",
        short: "Plush sensory cube with crinkle, squeak and mirror panels - safe from day one.",
        desc: "Six sides of discovery for little hands: crinkle fabric, a friendly squeaker, a baby-safe mirror, ribbon tags and contrast patterns that develop tracking vision. Sewn from soft, chew-safe fabrics with no loose parts, and the whole cube goes in the washing machine after inevitable adventures.",
      },
      sr: {
        title: "Mekana kocka za aktivnosti",
        short: "Plišana senzorna kocka sa šuškavim, piskavim i ogledalo panelima - bezbedna od prvog dana.",
        desc: "Šest strana otkrića za male ruke: šuškava tkanina, veseli pisak, ogledalce bezbedno za bebe, trakice i kontrastne šare koje razvijaju praćenje pogledom. Sašivena od mekih tkanina bezbednih za žvakanje, bez sitnih delova, a cela kocka ide u veš mašinu posle neizbežnih avantura.",
      },
      de: {
        title: "Weicher Aktivitätswürfel",
        short: "Plüsch-Sensorikwürfel mit Knister-, Quietsch- und Spiegelflächen - sicher vom ersten Tag an.",
        desc: "Sechs Seiten voller Entdeckungen für kleine Hände: Knisterstoff, ein freundlicher Quietscher, ein babysicherer Spiegel, Bänderschlaufen und Kontrastmuster, die das Blickfolgen fördern. Genäht aus weichen, speichelfesten Stoffen ohne Kleinteile - und nach unvermeidlichen Abenteuern darf der ganze Würfel in die Waschmaschine.",
      },
      es: {
        title: "Cubo de actividades blando",
        short: "Cubo sensorial de peluche con paneles crujientes, chirriantes y espejo - seguro desde el primer día.",
        desc: "Seis caras de descubrimiento para manos pequeñas: tela crujiente, un simpático chirriador, un espejo seguro para bebés, etiquetas de cinta y patrones de contraste que desarrollan el seguimiento visual. Cosido con tejidos suaves y seguros para morder, sin piezas sueltas, y el cubo entero va a la lavadora tras las aventuras inevitables.",
      },
    },
  },
  "stroller-lite": {
    brand: null,
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Stroller Lite",
        short: "6 kg city stroller that folds with one hand and fits in an overhead bin.",
        desc: "City parenting, simplified: the Stroller Lite weighs just six kilograms, folds with one hand while the other holds your child, and collapses small enough for most airline overhead bins. The reclining seat and extendable canopy handle naps on the go, and the suspension smooths cobblestones.",
      },
      sr: {
        title: "Kolica Lite",
        short: "Gradska kolica od 6 kg koja se sklapaju jednom rukom i staju u pretinac aviona.",
        desc: "Gradsko roditeljstvo, pojednostavljeno: Kolica Lite teže samo šest kilograma, sklapaju se jednom rukom dok druga drži dete i skupljaju se dovoljno malo za većinu avionskih pretinaca. Naslon koji se spušta i produživa tenda pokrivaju dremke u pokretu, a amortizacija pegla kaldrmu.",
      },
      de: {
        title: "Kinderwagen Lite",
        short: "6-kg-Citybuggy, der sich mit einer Hand falten lässt und ins Handgepäckfach passt.",
        desc: "Großstadt-Elternsein, vereinfacht: Der Kinderwagen Lite wiegt nur sechs Kilogramm, faltet sich mit einer Hand, während die andere das Kind hält, und wird klein genug für die meisten Gepäckfächer im Flugzeug. Die verstellbare Rückenlehne und das ausziehbare Verdeck meistern Nickerchen unterwegs, die Federung glättet Kopfsteinpflaster.",
      },
      es: {
        title: "Silla de paseo Lite",
        short: "Silla de paseo urbana de 6 kg que se pliega con una mano y cabe en el compartimento del avión.",
        desc: "Criar en la ciudad, simplificado: la silla de paseo Lite pesa solo seis kilogramos, se pliega con una mano mientras la otra sujeta a tu hijo y queda tan compacta que cabe en la mayoría de los compartimentos superiores del avión. El respaldo reclinable y la capota extensible resuelven las siestas sobre la marcha, y la suspensión suaviza los adoquines.",
      },
    },
  },
};
