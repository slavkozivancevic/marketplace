import type { BrandContent } from "./types";

// All brands, keyed by EN slug. The EN slug becomes the slug for every locale
// (BrandTranslation slug uniqueness is per-locale, so sharing is safe).
// logoFiles are Wikimedia Commons file names, tried in order via
// Special:FilePath, resolved to the final thumb URL at apply time.

export const brands: Record<string, BrandContent> = {
  apple: {
    slug: "apple",
    name: "Apple",
    logoFiles: ["Apple_logo_black.svg", "Apple_logo_grey.svg"],
    desc: {
      en: "Apple designs consumer electronics known for the iPhone, iPad and Mac, built around a tightly integrated ecosystem of hardware, software and services with a focus on design and privacy.",
      sr: "Apple dizajnira potrošačku elektroniku poznatu po iPhone, iPad i Mac uređajima, građenu oko čvrsto povezanog ekosistema hardvera, softvera i usluga, sa fokusom na dizajn i privatnost.",
      de: "Apple entwirft Unterhaltungselektronik, bekannt für iPhone, iPad und Mac, aufgebaut auf einem eng verzahnten Ökosystem aus Hardware, Software und Diensten mit Fokus auf Design und Datenschutz.",
      es: "Apple diseña electrónica de consumo conocida por el iPhone, el iPad y el Mac, construida sobre un ecosistema estrechamente integrado de hardware, software y servicios con foco en el diseño y la privacidad.",
    },
  },
  samsung: {
    slug: "samsung",
    name: "Samsung",
    logoFiles: ["Samsung_Logo.svg", "Samsung_wordmark.svg"],
    desc: {
      en: "Samsung is a global electronics leader spanning Galaxy smartphones and tablets, QLED and OLED televisions, home appliances and the semiconductors that power much of the industry.",
      sr: "Samsung je globalni lider u elektronici koji pokriva Galaxy telefone i tablete, QLED i OLED televizore, kućne aparate i poluprovodnike koji pokreću veliki deo industrije.",
      de: "Samsung ist ein weltweit führender Elektronikkonzern - von Galaxy-Smartphones und -Tablets über QLED- und OLED-Fernseher bis zu Hausgeräten und den Halbleitern, die einen Großteil der Branche antreiben.",
      es: "Samsung es un líder mundial de la electrónica que abarca los smartphones y tabletas Galaxy, televisores QLED y OLED, electrodomésticos y los semiconductores que impulsan buena parte de la industria.",
    },
  },
  sony: {
    slug: "sony",
    name: "Sony",
    logoFiles: ["Sony_logo.svg"],
    desc: {
      en: "Sony blends entertainment and engineering: PlayStation consoles, Alpha mirrorless cameras, premium headphones and audio gear trusted by studios and creators worldwide.",
      sr: "Sony spaja zabavu i inženjerstvo: PlayStation konzole, Alpha mirrorless kamere, premijum slušalice i audio opremu kojoj veruju studiji i kreatori širom sveta.",
      de: "Sony verbindet Unterhaltung und Ingenieurskunst: PlayStation-Konsolen, spiegellose Alpha-Kameras, Premium-Kopfhörer und Audiotechnik, der Studios und Kreative weltweit vertrauen.",
      es: "Sony combina entretenimiento e ingeniería: consolas PlayStation, cámaras sin espejo Alpha, auriculares premium y equipos de audio en los que confían estudios y creadores de todo el mundo.",
    },
  },
  dell: {
    slug: "dell",
    name: "Dell",
    logoFiles: ["Dell_Logo.svg", "Dell_logo_2016.svg"],
    desc: {
      en: "Dell builds reliable computing for work and play - XPS ultrabooks, Latitude business laptops, precision workstations and monitors found on desks in every industry.",
      sr: "Dell pravi pouzdane računare za posao i zabavu - XPS ultrabook-ove, Latitude poslovne laptopove, Precision radne stanice i monitore koji stoje na stolovima u svakoj industriji.",
      de: "Dell baut zuverlässige Computer für Arbeit und Freizeit - XPS-Ultrabooks, Latitude-Business-Laptops, Precision-Workstations und Monitore, die in jeder Branche auf den Schreibtischen stehen.",
      es: "Dell fabrica informática fiable para el trabajo y el ocio - ultrabooks XPS, portátiles profesionales Latitude, estaciones de trabajo Precision y monitores presentes en escritorios de todos los sectores.",
    },
  },
  lenovo: {
    slug: "lenovo",
    name: "Lenovo",
    logoFiles: ["Lenovo_logo_2015.svg", "Lenovo_Global_Corporate_Logo.png"],
    desc: {
      en: "Lenovo is one of the world's largest PC makers, home of the legendary ThinkPad line, Yoga convertibles and Legion gaming machines, engineered for durability and value.",
      sr: "Lenovo je jedan od najvećih svetskih proizvođača računara, dom legendarne ThinkPad linije, Yoga konvertibilnih i Legion gejming mašina, projektovanih za izdržljivost i vrednost.",
      de: "Lenovo ist einer der größten PC-Hersteller der Welt - Heimat der legendären ThinkPad-Reihe, der Yoga-Convertibles und der Legion-Gaming-Maschinen, konstruiert für Langlebigkeit und Preis-Leistung.",
      es: "Lenovo es uno de los mayores fabricantes de ordenadores del mundo, hogar de la legendaria línea ThinkPad, los convertibles Yoga y las máquinas gaming Legion, diseñados para durar y rendir.",
    },
  },
  lg: {
    slug: "lg",
    name: "LG",
    logoFiles: ["LG_logo_(2015).svg", "LG_symbol.svg"],
    desc: {
      en: "LG pioneered OLED television and builds award-winning home electronics - TVs, soundbars, monitors and appliances - with a focus on picture quality and smart-home integration.",
      sr: "LG je pionir OLED televizije i gradi nagrađivanu kućnu elektroniku - televizore, soundbar-ove, monitore i aparate - sa fokusom na kvalitet slike i integraciju pametnog doma.",
      de: "LG hat das OLED-Fernsehen mitbegründet und baut preisgekrönte Heimelektronik - Fernseher, Soundbars, Monitore und Haushaltsgeräte - mit Fokus auf Bildqualität und Smart-Home-Integration.",
      es: "LG fue pionera del televisor OLED y fabrica electrónica doméstica premiada - televisores, barras de sonido, monitores y electrodomésticos - con foco en la calidad de imagen y la integración del hogar inteligente.",
    },
  },
  canon: {
    slug: "canon",
    name: "Canon",
    logoFiles: ["Canon_wordmark.svg", "Canon_logo.svg"],
    desc: {
      en: "Canon has shaped photography for nearly a century: EOS cameras, RF lenses and imaging technology used by professionals, newsrooms and enthusiasts around the globe.",
      sr: "Canon oblikuje fotografiju skoro čitav vek: EOS kamere, RF objektivi i tehnologija snimanja koju koriste profesionalci, redakcije i entuzijasti širom sveta.",
      de: "Canon prägt die Fotografie seit fast einem Jahrhundert: EOS-Kameras, RF-Objektive und Bildtechnologie, auf die Profis, Redaktionen und Enthusiasten weltweit setzen.",
      es: "Canon lleva casi un siglo dando forma a la fotografía: cámaras EOS, objetivos RF y tecnología de imagen utilizada por profesionales, redacciones y aficionados de todo el mundo.",
    },
  },
  nike: {
    slug: "nike",
    name: "Nike",
    logoFiles: ["Logo_NIKE.svg"],
    desc: {
      en: "Nike is the world's leading sports brand, driving innovation in running shoes, training gear and athletic apparel worn by everyone from Olympians to weekend joggers.",
      sr: "Nike je vodeći svetski sportski brend, pokretač inovacija u patikama za trčanje, opremi za trening i sportskoj odeći koju nose svi - od olimpijaca do vikend trkača.",
      de: "Nike ist die führende Sportmarke der Welt und treibt Innovationen bei Laufschuhen, Trainingsausrüstung und Sportbekleidung voran - getragen von Olympioniken bis zu Wochenendläufern.",
      es: "Nike es la marca deportiva líder mundial, impulsora de la innovación en zapatillas de running, equipamiento de entrenamiento y ropa deportiva que visten desde olímpicos hasta corredores de fin de semana.",
    },
  },
  adidas: {
    slug: "adidas",
    name: "Adidas",
    logoFiles: ["Adidas_Logo.svg", "Adidas_isologo.svg"],
    desc: {
      en: "Adidas combines German engineering with street culture: performance footwear, football kits and the three-stripe classics that move effortlessly between stadium and city.",
      sr: "Adidas spaja nemačko inženjerstvo sa uličnom kulturom: performans obuću, fudbalsku opremu i klasike sa tri trake koji se bez napora kreću između stadiona i grada.",
      de: "Adidas verbindet deutsche Ingenieurskunst mit Streetculture: Performance-Schuhe, Fußballtrikots und die Drei-Streifen-Klassiker, die mühelos zwischen Stadion und Stadt wechseln.",
      es: "Adidas combina la ingeniería alemana con la cultura urbana: calzado de rendimiento, equipaciones de fútbol y los clásicos de las tres bandas que se mueven sin esfuerzo entre el estadio y la ciudad.",
    },
  },
  zara: {
    slug: "zara",
    name: "Zara",
    logoFiles: ["Zara_Logo.svg", "ZARA_logo.svg"],
    desc: {
      en: "Zara brings runway trends to the high street in weeks, with fast-moving collections of womenswear, menswear and accessories refreshed continuously through the season.",
      sr: "Zara donosi trendove sa pista u gradske ulice za nekoliko nedelja, sa brzim kolekcijama ženske i muške odeće i aksesoara koje se osvežavaju tokom cele sezone.",
      de: "Zara bringt Laufsteg-Trends binnen Wochen in die Einkaufsstraße - mit schnell wechselnden Kollektionen für Damen, Herren und Accessoires, die die ganze Saison über aufgefrischt werden.",
      es: "Zara lleva las tendencias de pasarela a la calle en cuestión de semanas, con colecciones ágiles de moda femenina, masculina y accesorios que se renuevan continuamente durante la temporada.",
    },
  },
  hm: {
    slug: "hm",
    name: "H&M",
    logoFiles: ["H&M-Logo.svg"],
    desc: {
      en: "H&M makes fashion accessible: everyday wardrobe essentials, kidswear and seasonal collections at prices that let the whole family refresh their style.",
      sr: "H&M čini modu dostupnom: osnovne komade za svaki dan, dečiju garderobu i sezonske kolekcije po cenama koje celoj porodici dozvoljavaju da osveži stil.",
      de: "H&M macht Mode zugänglich: Alltagsbasics, Kindermode und Saisonkollektionen zu Preisen, mit denen die ganze Familie ihren Stil auffrischen kann.",
      es: "H&M hace la moda accesible: básicos de armario para el día a día, ropa infantil y colecciones de temporada a precios que permiten a toda la familia renovar su estilo.",
    },
  },
  levis: {
    slug: "levis",
    name: "Levi's",
    logoFiles: ["Levi's_logo.svg", "Levis-logo-quer.svg"],
    desc: {
      en: "Levi's invented the blue jean in 1873 and still sets the standard: the 501 original, trucker jackets and denim built to be worn in, worn out and handed down.",
      sr: "Levi's je izmislio farmerke 1873. i dalje postavlja standard: original 501, trucker jakne i teksas građen da se razgazi, iznosi i nasledi.",
      de: "Levi's hat 1873 die Blue Jeans erfunden und setzt bis heute den Standard: die originale 501, Trucker-Jacken und Denim, gemacht zum Eintragen, Abtragen und Weitervererben.",
      es: "Levi's inventó los vaqueros en 1873 y sigue marcando el estándar: los 501 originales, las chaquetas trucker y un denim hecho para amoldarse, desgastarse y heredarse.",
    },
  },
  ikea: {
    slug: "ikea",
    name: "IKEA",
    logoFiles: ["Ikea_logo.svg", "IKEA_logo.svg"],
    desc: {
      en: "IKEA democratizes home design with flat-pack furniture, smart storage and home essentials that combine Scandinavian form, function and famously approachable prices.",
      sr: "IKEA demokratizuje uređenje doma nameštajem u ravnim paketima, pametnim odlaganjem i kućnim potrepštinama koje spajaju skandinavsku formu, funkciju i čuveno pristupačne cene.",
      de: "IKEA demokratisiert das Wohnen mit Flatpack-Möbeln, cleverem Stauraum und Wohn-Essentials, die skandinavische Form, Funktion und berühmt zugängliche Preise vereinen.",
      es: "IKEA democratiza el diseño del hogar con muebles en paquete plano, almacenaje inteligente y básicos para la casa que combinan forma escandinava, función y precios famosamente asequibles.",
    },
  },
  bosch: {
    slug: "bosch",
    name: "Bosch",
    logoFiles: ["Bosch-logo.svg", "Robert_Bosch_GmbH_logo.svg", "Bosch-logotype.svg"],
    desc: {
      en: "Bosch stands for German engineering across power tools, kitchen appliances and automotive technology - products built to survive decades of daily use.",
      sr: "Bosch je sinonim za nemačko inženjerstvo u električnim alatima, kuhinjskim aparatima i automobilskoj tehnologiji - proizvodi građeni da prežive decenije svakodnevne upotrebe.",
      de: "Bosch steht für deutsche Ingenieurskunst bei Elektrowerkzeugen, Küchengeräten und Automobiltechnik - Produkte, die Jahrzehnte täglichen Gebrauchs überstehen.",
      es: "Bosch representa la ingeniería alemana en herramientas eléctricas, electrodomésticos de cocina y tecnología del automóvil - productos hechos para sobrevivir décadas de uso diario.",
    },
  },
  lego: {
    slug: "lego",
    name: "LEGO",
    logoFiles: ["LEGO_logo.svg"],
    desc: {
      en: "The LEGO Group has fueled imagination since 1932: interlocking bricks, Technic machines and themed sets that turn play into building, storytelling and engineering.",
      sr: "LEGO grupa pokreće maštu od 1932: kocke koje se uklapaju, Technic mašine i tematski setovi koji igru pretvaraju u građenje, pripovedanje i inženjerstvo.",
      de: "Die LEGO Gruppe beflügelt seit 1932 die Fantasie: Klemmbausteine, Technic-Maschinen und Themensets, die Spielen in Bauen, Geschichtenerzählen und Ingenieurskunst verwandeln.",
      es: "El Grupo LEGO alimenta la imaginación desde 1932: ladrillos encajables, máquinas Technic y sets temáticos que convierten el juego en construcción, narración e ingeniería.",
    },
  },
  nokia: {
    slug: "nokia",
    name: "Nokia",
    logoFiles: ["Nokia_wordmark.svg", "Nokia_2023.svg", "Nokia_Logo.svg"],
    desc: {
      en: "Nokia, the Finnish telecommunications pioneer, is known for famously durable phones and today builds 5G networks and affordable smartphones with clean software and long support.",
      sr: "Nokia, finski pionir telekomunikacija, poznata je po čuveno izdržljivim telefonima, a danas gradi 5G mreže i pristupačne pametne telefone sa čistim softverom i dugom podrškom.",
      de: "Nokia, der finnische Telekommunikationspionier, ist für legendär robuste Telefone bekannt und baut heute 5G-Netze sowie erschwingliche Smartphones mit schlanker Software und langem Support.",
      es: "Nokia, la pionera finlandesa de las telecomunicaciones, es famosa por sus teléfonos legendariamente resistentes y hoy construye redes 5G y smartphones asequibles con software limpio y soporte prolongado.",
    },
  },
};
