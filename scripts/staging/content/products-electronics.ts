import type { ProductContent } from "./types";

// Electronics: laptops, phones/tablets, TV & audio, cameras, gaming.
// Keyed by the product's CURRENT en slug (en slugs never change).

export const electronics: Record<string, ProductContent> = {
  "ultrabook-pro-14": {
    brand: "samsung",
    variants: { mode: "colors", palette: ["black", "gray", "white", "blue"] },
    t: {
      en: {
        title: "UltraBook Pro 14",
        short: "Slim 14-inch ultrabook with an all-day battery and a bright, color-accurate display.",
        desc: "The UltraBook Pro 14 packs serious performance into a body that weighs barely more than a kilogram. A bright 14-inch display with accurate colors, a precise glass trackpad and an all-day battery make it a dependable companion for work and travel. The backlit keyboard and fast SSD storage round out a machine built for people who are always on the move.",
      },
      sr: {
        title: "UltraBook Pro 14",
        short: "Tanak ultrabook od 14 inča sa baterijom za ceo dan i svetlim ekranom vernih boja.",
        desc: "UltraBook Pro 14 smešta ozbiljne performanse u kućište jedva teže od kilograma. Svetao ekran od 14 inča sa vernim bojama, precizan stakleni trackpad i baterija koja traje ceo dan čine ga pouzdanim saputnikom za posao i putovanja. Tastatura sa pozadinskim osvetljenjem i brzi SSD zaokružuju mašinu stvorenu za ljude koji su stalno u pokretu.",
      },
      de: {
        title: "UltraBook Pro 14",
        short: "Schlankes 14-Zoll-Ultrabook mit ganztägiger Akkulaufzeit und hellem, farbtreuem Display.",
        desc: "Das UltraBook Pro 14 vereint starke Leistung in einem Gehäuse, das kaum mehr als ein Kilogramm wiegt. Ein helles 14-Zoll-Display mit präzisen Farben, ein exaktes Glas-Trackpad und ein Akku für den ganzen Tag machen es zum verlässlichen Begleiter für Arbeit und Reise. Beleuchtete Tastatur und schneller SSD-Speicher runden das Paket ab.",
      },
      es: {
        title: "UltraBook Pro 14",
        short: "Ultrabook fino de 14 pulgadas con batería para todo el día y pantalla brillante de color preciso.",
        desc: "El UltraBook Pro 14 concentra un gran rendimiento en un cuerpo que apenas supera el kilogramo. Su pantalla de 14 pulgadas con colores precisos, el trackpad de cristal y una batería que dura toda la jornada lo convierten en un compañero fiable para el trabajo y los viajes. El teclado retroiluminado y el rápido almacenamiento SSD completan el conjunto.",
      },
    },
  },
  "office-laptop-15": {
    brand: "dell",
    variants: { mode: "colors", palette: ["black", "gray", "white", "blue"] },
    t: {
      en: {
        title: "Office Laptop 15",
        short: "Dependable 15.6-inch business laptop with a full keyboard and rich port selection.",
        desc: "A no-nonsense workhorse for the office and the home desk. The Office Laptop 15 offers a comfortable full-size keyboard with a numeric pad, a matte 15.6-inch screen that stays readable under office lighting, and every port you need - HDMI, USB-A, USB-C and Ethernet - without carrying a bag of adapters.",
      },
      sr: {
        title: "Kancelarijski laptop 15",
        short: "Pouzdan poslovni laptop od 15,6 inča sa punom tastaturom i bogatim izborom portova.",
        desc: "Radni konj bez kompromisa za kancelariju i kućni sto. Kancelarijski laptop 15 nudi udobnu tastaturu pune veličine sa numeričkim delom, mat ekran od 15,6 inča koji ostaje čitljiv pod kancelarijskim osvetljenjem i sve potrebne portove - HDMI, USB-A, USB-C i Ethernet - bez torbe pune adaptera.",
      },
      de: {
        title: "Office-Laptop 15",
        short: "Zuverlässiges 15,6-Zoll-Business-Notebook mit vollwertiger Tastatur und vielen Anschlüssen.",
        desc: "Ein unkompliziertes Arbeitstier für Büro und Homeoffice. Der Office-Laptop 15 bietet eine komfortable Tastatur mit Ziffernblock, ein mattes 15,6-Zoll-Display, das auch unter Bürolicht gut lesbar bleibt, und alle wichtigen Anschlüsse - HDMI, USB-A, USB-C und Ethernet - ganz ohne Adaptersammlung.",
      },
      es: {
        title: "Portátil de oficina 15",
        short: "Portátil de empresa fiable de 15,6 pulgadas con teclado completo y gran variedad de puertos.",
        desc: "Un caballo de batalla sin complicaciones para la oficina y el escritorio de casa. El portátil de oficina 15 ofrece un cómodo teclado completo con panel numérico, una pantalla mate de 15,6 pulgadas legible bajo luz de oficina y todos los puertos necesarios - HDMI, USB-A, USB-C y Ethernet - sin necesidad de adaptadores.",
      },
    },
  },
  "gaming-notebook-x": {
    brand: "lenovo",
    variants: { mode: "colors", palette: ["black", "gray", "red", "blue"] },
    t: {
      en: {
        title: "Gaming Notebook X",
        short: "High-refresh gaming laptop with dedicated graphics and an advanced cooling system.",
        desc: "Built for high frame rates, the Gaming Notebook X pairs a dedicated graphics card with a fast high-refresh display so the action stays smooth even in demanding titles. A dual-fan cooling system keeps clocks high under sustained load, and the per-key RGB keyboard lets you set the mood for every session.",
      },
      sr: {
        title: "Gejming laptop X",
        short: "Gejming laptop sa visokim osvežavanjem, namenskom grafikom i naprednim hlađenjem.",
        desc: "Stvoren za visok broj frejmova, Gejming laptop X kombinuje namensku grafičku kartu sa brzim ekranom visokog osvežavanja, pa akcija ostaje glatka i u najzahtevnijim igrama. Sistem hlađenja sa dva ventilatora održava visoke taktove pod dugotrajnim opterećenjem, a RGB tastatura sa osvetljenjem po tasteru daje atmosferu svakoj sesiji.",
      },
      de: {
        title: "Gaming-Notebook X",
        short: "Gaming-Laptop mit hoher Bildwiederholrate, dedizierter Grafik und starkem Kühlsystem.",
        desc: "Das Gaming-Notebook X wurde für hohe Bildraten gebaut: dedizierte Grafikkarte plus schnelles Display mit hoher Bildwiederholrate halten die Action auch in fordernden Titeln flüssig. Die Kühlung mit zwei Lüftern sichert hohe Taktraten unter Dauerlast, und die RGB-Tastatur mit Einzeltastenbeleuchtung sorgt für Stimmung bei jeder Session.",
      },
      es: {
        title: "Portátil gaming X",
        short: "Portátil gaming de alta tasa de refresco con gráfica dedicada y refrigeración avanzada.",
        desc: "Creado para altas tasas de fotogramas, el portátil gaming X combina una tarjeta gráfica dedicada con una pantalla rápida de alto refresco para que la acción sea fluida incluso en los títulos más exigentes. Su refrigeración de doble ventilador mantiene el rendimiento bajo carga sostenida, y el teclado RGB por tecla pone el ambiente en cada partida.",
      },
    },
  },
  "student-chromebook": {
    brand: "samsung",
    variants: { mode: "colors", palette: ["black", "gray", "white", "blue"] },
    t: {
      en: {
        title: "Student Chromebook",
        short: "Lightweight, affordable Chromebook with instant boot and long battery life for school work.",
        desc: "The Student Chromebook keeps things simple: it boots in seconds, updates itself and shrugs off everyday knocks thanks to a reinforced chassis. With a battery that easily outlasts a school day and automatic cloud backup of documents, it is an easy pick for students and shared family use.",
      },
      sr: {
        title: "Studentski Chromebook",
        short: "Lagan i pristupačan Chromebook sa trenutnim pokretanjem i dugom baterijom za školske obaveze.",
        desc: "Studentski Chromebook ne komplikuje: podiže se za par sekundi, sam se ažurira i podnosi svakodnevne udarce zahvaljujući ojačanom kućištu. Sa baterijom koja lako izdrži ceo školski dan i automatskim čuvanjem dokumenata u oblaku, lak je izbor za đake, studente i zajedničku porodičnu upotrebu.",
      },
      de: {
        title: "Studenten-Chromebook",
        short: "Leichtes, günstiges Chromebook mit Sofortstart und langer Akkulaufzeit für den Schulalltag.",
        desc: "Das Studenten-Chromebook macht es einfach: Es startet in Sekunden, aktualisiert sich selbst und steckt den Alltag dank verstärktem Gehäuse locker weg. Mit einem Akku, der einen ganzen Schultag durchhält, und automatischer Cloud-Sicherung der Dokumente ist es die unkomplizierte Wahl für Schüler, Studierende und die ganze Familie.",
      },
      es: {
        title: "Chromebook para estudiantes",
        short: "Chromebook ligero y asequible con arranque instantáneo y gran autonomía para las tareas escolares.",
        desc: "El Chromebook para estudiantes lo pone fácil: arranca en segundos, se actualiza solo y aguanta los golpes del día a día gracias a su chasis reforzado. Con una batería que supera con holgura la jornada escolar y copia de seguridad automática en la nube, es la elección sencilla para estudiantes y para compartir en familia.",
      },
    },
  },
  "workstation-tower": {
    brand: "dell",
    variants: { mode: "colors", palette: ["black", "gray"] },
    t: {
      en: {
        title: "Workstation Tower",
        short: "Expandable tower workstation with professional-grade performance for creators and engineers.",
        desc: "When a laptop is not enough, the Workstation Tower delivers professional-grade computing with room to grow: multiple drive bays, generous memory capacity and a power supply sized for serious GPUs. Certified for stability under long renders and simulations, it is a machine you configure once and rely on for years.",
      },
      sr: {
        title: "Radna stanica",
        short: "Proširiva desktop radna stanica sa profesionalnim performansama za kreatore i inženjere.",
        desc: "Kada laptop nije dovoljan, Radna stanica pruža računarske performanse profesionalne klase uz prostor za nadogradnju: više ležišta za diskove, izdašan kapacitet memorije i napajanje dimenzionisano za ozbiljne grafičke karte. Stabilna pod dugim renderima i simulacijama, ovo je mašina koju konfigurišete jednom i na koju se oslanjate godinama.",
      },
      de: {
        title: "Workstation-Tower",
        short: "Erweiterbare Tower-Workstation mit Profi-Leistung für Kreative und Ingenieure.",
        desc: "Wenn ein Laptop nicht mehr reicht, liefert der Workstation-Tower Rechenleistung auf Profi-Niveau mit Platz zum Wachsen: mehrere Laufwerksschächte, großzügige Speicherkapazität und ein Netzteil, das auch anspruchsvolle Grafikkarten versorgt. Stabil bei langen Renderings und Simulationen - einmal konfigurieren, jahrelang darauf verlassen.",
      },
      es: {
        title: "Torre de trabajo",
        short: "Estación de trabajo ampliable con rendimiento profesional para creadores e ingenieros.",
        desc: "Cuando un portátil se queda corto, la torre de trabajo ofrece potencia de clase profesional con espacio para crecer: varias bahías de disco, gran capacidad de memoria y una fuente preparada para tarjetas gráficas exigentes. Estable en renders y simulaciones largas, es una máquina que se configura una vez y dura años.",
      },
    },
  },
  "convertible-2-in-1": {
    brand: "lenovo",
    variants: { mode: "colors", palette: ["black", "gray", "white", "blue"] },
    t: {
      en: {
        title: "Convertible 2-in-1",
        short: "Versatile 2-in-1 laptop with a 360° hinge, touch display and stylus support.",
        desc: "One device, four modes: laptop for typing, tent for movies, stand for presentations and tablet for sketching. The Convertible 2-in-1's sturdy 360° hinge, responsive touch display and stylus support adapt to however you work, while the aluminium body keeps it thin enough to carry everywhere.",
      },
      sr: {
        title: "Konvertibilni 2-u-1",
        short: "Svestrani 2-u-1 laptop sa šarkom od 360°, ekranom na dodir i podrškom za olovku.",
        desc: "Jedan uređaj, četiri režima: laptop za kucanje, šator za filmove, postolje za prezentacije i tablet za skiciranje. Čvrsta šarka od 360°, responzivan ekran na dodir i podrška za olovku prilagođavaju se načinu na koji radite, dok aluminijumsko kućište ostaje dovoljno tanko da ga nosite svuda.",
      },
      de: {
        title: "Convertible 2-in-1",
        short: "Vielseitiges 2-in-1-Notebook mit 360°-Scharnier, Touchdisplay und Stiftunterstützung.",
        desc: "Ein Gerät, vier Modi: Laptop zum Tippen, Zelt für Filme, Ständer für Präsentationen und Tablet zum Skizzieren. Das stabile 360°-Scharnier, das reaktionsschnelle Touchdisplay und die Stiftunterstützung passen sich Ihrer Arbeitsweise an, während das Aluminiumgehäuse schlank genug für jeden Tag bleibt.",
      },
      es: {
        title: "Convertible 2 en 1",
        short: "Portátil 2 en 1 versátil con bisagra de 360°, pantalla táctil y compatibilidad con lápiz.",
        desc: "Un dispositivo, cuatro modos: portátil para escribir, tienda para películas, atril para presentaciones y tableta para dibujar. Su robusta bisagra de 360°, la pantalla táctil de respuesta rápida y la compatibilidad con lápiz se adaptan a tu forma de trabajar, con un cuerpo de aluminio fino para llevarlo a todas partes.",
      },
    },
  },
  "galaxy-phone-s": {
    brand: "samsung",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Galaxy Phone S",
        short: "Flagship smartphone with a pro-grade triple camera and a brilliant AMOLED display.",
        desc: "The Galaxy Phone S brings flagship photography to your pocket: a pro-grade triple camera with optical zoom, night mode that actually works and 8K video capture. The brilliant AMOLED display refreshes at 120 Hz for silky scrolling, and fast wireless charging keeps downtime short.",
      },
      sr: {
        title: "Galaxy telefon S",
        short: "Vodeći pametni telefon sa profesionalnom trostrukom kamerom i sjajnim AMOLED ekranom.",
        desc: "Galaxy telefon S donosi vrhunsku fotografiju u vaš džep: profesionalna trostruka kamera sa optičkim zumom, noćni režim koji zaista radi i snimanje videa u 8K. Sjajni AMOLED ekran osvežava se na 120 Hz za savršeno glatko listanje, a brzo bežično punjenje skraćuje svaku pauzu.",
      },
      de: {
        title: "Galaxy Phone S",
        short: "Flaggschiff-Smartphone mit Dreifachkamera in Profiqualität und brillantem AMOLED-Display.",
        desc: "Das Galaxy Phone S bringt Flaggschiff-Fotografie in Ihre Tasche: eine Dreifachkamera mit optischem Zoom, ein Nachtmodus, der wirklich funktioniert, und 8K-Videoaufnahme. Das brillante AMOLED-Display mit 120 Hz sorgt für seidiges Scrollen, schnelles kabelloses Laden hält die Pausen kurz.",
      },
      es: {
        title: "Galaxy Phone S",
        short: "Smartphone insignia con cámara triple de nivel profesional y brillante pantalla AMOLED.",
        desc: "El Galaxy Phone S trae la fotografía de gama alta a tu bolsillo: cámara triple profesional con zoom óptico, un modo noche que funciona de verdad y grabación de vídeo en 8K. La brillante pantalla AMOLED de 120 Hz ofrece un desplazamiento sedoso, y la carga inalámbrica rápida reduce los tiempos de espera.",
      },
    },
  },
  "pro-max-smartphone": {
    brand: "apple",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Pro Max Smartphone",
        short: "Top-tier smartphone with a large ProMotion display, titanium frame and all-day battery.",
        desc: "The Pro Max Smartphone is the no-compromise choice: a large, ultra-bright display with adaptive refresh, a titanium frame that keeps weight down, and a camera system that handles everything from macro shots to cinematic video. Battery life comfortably covers the longest days.",
      },
      sr: {
        title: "Pro Max pametni telefon",
        short: "Telefon najviše klase sa velikim ProMotion ekranom, titanijumskim ramom i baterijom za ceo dan.",
        desc: "Pro Max pametni telefon je izbor bez kompromisa: veliki, izuzetno svetao ekran sa adaptivnim osvežavanjem, titanijumski ram koji smanjuje težinu i sistem kamera koji pokriva sve od makro fotografija do filmskog videa. Baterija bez problema pokriva i najduže dane.",
      },
      de: {
        title: "Pro Max Smartphone",
        short: "Smartphone der Spitzenklasse mit großem ProMotion-Display, Titanrahmen und ganztägigem Akku.",
        desc: "Das Pro Max Smartphone ist die kompromisslose Wahl: ein großes, extrem helles Display mit adaptiver Bildwiederholrate, ein Titanrahmen für weniger Gewicht und ein Kamerasystem, das von Makroaufnahmen bis zu filmreifem Video alles beherrscht. Der Akku übersteht auch die längsten Tage mühelos.",
      },
      es: {
        title: "Smartphone Pro Max",
        short: "Smartphone de gama máxima con gran pantalla ProMotion, marco de titanio y batería para todo el día.",
        desc: "El smartphone Pro Max es la elección sin concesiones: una pantalla grande y ultrabrillante con refresco adaptativo, un marco de titanio que reduce el peso y un sistema de cámaras que domina desde la macro hasta el vídeo cinematográfico. La batería cubre de sobra los días más largos.",
      },
    },
  },
  "budget-phone-lite": {
    brand: "nokia",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Budget Phone Lite",
        short: "Affordable smartphone with a big battery, clean software and two-day endurance.",
        desc: "The Budget Phone Lite proves a good phone does not have to cost a fortune. A big battery routinely stretches to two days, the clean near-stock software stays fast over time, and the sturdy polycarbonate body takes daily life in stride. Includes a headphone jack and expandable storage.",
      },
      sr: {
        title: "Budžet telefon Lite",
        short: "Pristupačan pametni telefon sa velikom baterijom, čistim softverom i trajanjem od dva dana.",
        desc: "Budžet telefon Lite dokazuje da dobar telefon ne mora da košta bogatstvo. Velika baterija redovno izdrži dva dana, čist softver blizak osnovnom Androidu ostaje brz tokom vremena, a čvrsto polikarbonatno kućište mirno podnosi svakodnevicu. Tu su i priključak za slušalice i proširiva memorija.",
      },
      de: {
        title: "Budget Phone Lite",
        short: "Günstiges Smartphone mit großem Akku, schlanker Software und zwei Tagen Laufzeit.",
        desc: "Das Budget Phone Lite beweist, dass ein gutes Telefon kein Vermögen kosten muss. Der große Akku hält regelmäßig zwei Tage durch, die schlanke, systemnahe Software bleibt dauerhaft flott, und das robuste Polycarbonatgehäuse steckt den Alltag locker weg. Kopfhöreranschluss und erweiterbarer Speicher inklusive.",
      },
      es: {
        title: "Teléfono Budget Lite",
        short: "Smartphone asequible con gran batería, software limpio y autonomía de dos días.",
        desc: "El teléfono Budget Lite demuestra que un buen móvil no tiene por qué costar una fortuna. Su gran batería alcanza fácilmente los dos días, el software limpio y cercano al sistema base se mantiene rápido con el tiempo, y el resistente cuerpo de policarbonato aguanta el día a día. Incluye conector de auriculares y almacenamiento ampliable.",
      },
    },
  },
  "tablet-air-11": {
    brand: "apple",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Tablet Air 11",
        short: "Thin and light 11-inch tablet for reading, streaming, drawing and getting work done.",
        desc: "The Tablet Air 11 hits the sweet spot between portability and screen space. The laminated 11-inch display is sharp enough for split-screen work and vivid enough for movies, the speakers fire in stereo in landscape, and stylus plus keyboard support turn it into a genuine laptop stand-in when you need one.",
      },
      sr: {
        title: "Tablet Air 11",
        short: "Tanak i lagan tablet od 11 inča za čitanje, striming, crtanje i posao.",
        desc: "Tablet Air 11 pogađa idealan odnos prenosivosti i površine ekrana. Laminirani ekran od 11 inča dovoljno je oštar za rad u podeljenom prikazu i dovoljno živopisan za filmove, zvučnici sviraju stereo u položenom režimu, a podrška za olovku i tastaturu pretvara ga u pravu zamenu za laptop kada zatreba.",
      },
      de: {
        title: "Tablet Air 11",
        short: "Dünnes, leichtes 11-Zoll-Tablet zum Lesen, Streamen, Zeichnen und Arbeiten.",
        desc: "Das Tablet Air 11 trifft den idealen Punkt zwischen Mobilität und Bildschirmfläche. Das laminierte 11-Zoll-Display ist scharf genug für Split-Screen-Arbeit und brillant genug für Filme, die Lautsprecher spielen im Querformat in Stereo, und mit Stift- und Tastaturunterstützung wird es bei Bedarf zum echten Laptop-Ersatz.",
      },
      es: {
        title: "Tableta Air 11",
        short: "Tableta fina y ligera de 11 pulgadas para leer, ver series, dibujar y trabajar.",
        desc: "La tableta Air 11 encuentra el punto justo entre portabilidad y superficie de pantalla. Su pantalla laminada de 11 pulgadas es nítida para trabajar a pantalla partida y vívida para el cine, los altavoces suenan en estéreo en horizontal, y con lápiz y teclado se convierte en una auténtica sustituta del portátil cuando hace falta.",
      },
    },
  },
  "mini-tablet-8": {
    brand: "samsung",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Mini Tablet 8",
        short: "Compact 8-inch tablet that fits in one hand - perfect for reading and travel.",
        desc: "Small enough to hold in one hand and slip into a jacket pocket, the Mini Tablet 8 is the ideal travel companion. The sharp 8-inch screen makes e-books and comics a pleasure, battery life runs into days of casual use, and the lightweight build means you will actually take it everywhere.",
      },
      sr: {
        title: "Mini tablet 8",
        short: "Kompaktan tablet od 8 inča koji staje u jednu ruku - savršen za čitanje i putovanja.",
        desc: "Dovoljno mali da ga držite jednom rukom i spustite u džep jakne, Mini tablet 8 je idealan saputnik za put. Oštar ekran od 8 inča čini e-knjige i stripove pravim uživanjem, baterija traje danima uz ležernu upotrebu, a mala težina znači da ćete ga zaista svuda nositi.",
      },
      de: {
        title: "Mini-Tablet 8",
        short: "Kompaktes 8-Zoll-Tablet für eine Hand - perfekt zum Lesen und auf Reisen.",
        desc: "Klein genug für eine Hand und die Jackentasche ist das Mini-Tablet 8 der ideale Reisebegleiter. Der scharfe 8-Zoll-Bildschirm macht E-Books und Comics zum Vergnügen, der Akku hält bei gelegentlicher Nutzung tagelang, und dank des geringen Gewichts nehmen Sie es wirklich überallhin mit.",
      },
      es: {
        title: "Mini tableta 8",
        short: "Tableta compacta de 8 pulgadas que cabe en una mano - perfecta para leer y viajar.",
        desc: "Lo bastante pequeña para sujetarla con una mano y guardarla en el bolsillo de la chaqueta, la mini tableta 8 es la compañera de viaje ideal. Su nítida pantalla de 8 pulgadas hace que leer libros y cómics sea un placer, la batería dura días con un uso ocasional y su ligereza hace que de verdad la lleves a todas partes.",
      },
    },
  },
  "foldable-phone-z": {
    brand: "samsung",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Foldable Phone Z",
        short: "Folding smartphone that opens into a tablet-sized display for true multitasking.",
        desc: "The Foldable Phone Z is two devices in one: a pocketable phone that unfolds into a tablet-sized canvas for reading, multitasking and video calls. The refined hinge feels solid through thousands of folds, and app continuity means whatever you start on the cover screen continues seamlessly on the main display.",
      },
      sr: {
        title: "Preklopni telefon Z",
        short: "Telefon na preklop koji se otvara u ekran veličine tableta za pravi multitasking.",
        desc: "Preklopni telefon Z su dva uređaja u jednom: telefon za džep koji se rasklapa u platno veličine tableta za čitanje, multitasking i video pozive. Usavršena šarka deluje čvrsto i posle više hiljada preklapanja, a kontinuitet aplikacija znači da se sve što započnete na spoljnom ekranu neprimetno nastavlja na glavnom.",
      },
      de: {
        title: "Foldable Phone Z",
        short: "Faltbares Smartphone, das sich zu einem Display in Tablet-Größe für echtes Multitasking öffnet.",
        desc: "Das Foldable Phone Z ist zwei Geräte in einem: ein taschentaugliches Telefon, das sich zu einer tabletgroßen Fläche für Lesen, Multitasking und Videoanrufe entfaltet. Das ausgereifte Scharnier bleibt über tausende Faltvorgänge stabil, und dank App-Kontinuität läuft alles vom Frontdisplay nahtlos auf dem Hauptbildschirm weiter.",
      },
      es: {
        title: "Teléfono plegable Z",
        short: "Smartphone plegable que se abre en una pantalla de tamaño tableta para un multitarea real.",
        desc: "El teléfono plegable Z son dos dispositivos en uno: un móvil de bolsillo que se despliega en un lienzo del tamaño de una tableta para leer, hacer multitarea y videollamadas. La bisagra refinada se mantiene sólida tras miles de pliegues, y la continuidad de apps hace que lo que empieces en la pantalla exterior siga sin cortes en la principal.",
      },
    },
  },
  "4k-smart-tv-55": {
    brand: "samsung",
    variants: { mode: "colors", palette: ["black", "gray"] },
    t: {
      en: {
        title: "4K Smart TV 55",
        short: "55-inch 4K smart TV with HDR, streaming apps built in and a slim three-side bezel-less design.",
        desc: "Movie nights get an upgrade with the 4K Smart TV 55. HDR brings out detail in shadows and highlights, the built-in smart platform puts every major streaming app one click away, and the slim bezel-less design looks right at home on a wall or a stand. A low-latency game mode keeps console play responsive.",
      },
      sr: {
        title: "4K Smart TV 55",
        short: "Pametni 4K televizor od 55 inča sa HDR-om, ugrađenim striming aplikacijama i tankim okvirom.",
        desc: "Filmske večeri dobijaju nadogradnju uz 4K Smart TV 55. HDR izvlači detalje iz senki i svetlih tonova, ugrađena pametna platforma stavlja sve velike striming aplikacije na jedan klik, a tanak dizajn bez okvira sa tri strane lepo stoji i na zidu i na postolju. Režim za igranje sa niskim kašnjenjem čini konzole responzivnim.",
      },
      de: {
        title: "4K Smart TV 55",
        short: "55-Zoll-4K-Smart-TV mit HDR, integrierten Streaming-Apps und schmalem, fast rahmenlosem Design.",
        desc: "Filmabende bekommen ein Upgrade mit dem 4K Smart TV 55. HDR holt Details aus Schatten und Lichtern, die integrierte Smart-Plattform bringt alle großen Streaming-Apps auf einen Klick, und das schmale, fast rahmenlose Design macht an Wand wie Standfuß eine gute Figur. Der Spielmodus mit niedriger Latenz hält Konsolen reaktionsschnell.",
      },
      es: {
        title: "Smart TV 4K 55",
        short: "Televisor inteligente 4K de 55 pulgadas con HDR, apps de streaming integradas y marco fino.",
        desc: "Las noches de cine suben de nivel con el Smart TV 4K 55. El HDR revela detalles en sombras y luces, la plataforma inteligente integrada pone todas las grandes apps de streaming a un clic, y el diseño de marco fino queda perfecto en la pared o sobre el mueble. Su modo juego de baja latencia mantiene la consola siempre reactiva.",
      },
    },
  },
  "oled-tv-65": {
    brand: "lg",
    variants: { mode: "colors", palette: ["black", "gray"] },
    t: {
      en: {
        title: "OLED TV 65",
        short: "65-inch OLED TV with perfect blacks, cinema-grade color and next-gen gaming features.",
        desc: "Self-lit OLED pixels deliver what LCD simply cannot: perfect blacks, infinite contrast and color that filmmakers intended. The OLED TV 65 adds next-gen gaming features - 120 Hz, VRR and auto low-latency mode - plus a processor that upscales everything you watch to near-4K clarity.",
      },
      sr: {
        title: "OLED TV 65",
        short: "OLED televizor od 65 inča sa savršenom crnom, filmskim bojama i gejming funkcijama nove generacije.",
        desc: "Samoosvetljavajući OLED pikseli pružaju ono što LCD jednostavno ne može: savršenu crnu, beskonačan kontrast i boje kakve su autori filma zamislili. OLED TV 65 dodaje i gejming funkcije nove generacije - 120 Hz, VRR i automatski režim niskog kašnjenja - uz procesor koji sve što gledate podiže blizu 4K oštrine.",
      },
      de: {
        title: "OLED TV 65",
        short: "65-Zoll-OLED-TV mit perfektem Schwarz, Kinofarben und Next-Gen-Gaming-Funktionen.",
        desc: "Selbstleuchtende OLED-Pixel liefern, was LCD nicht kann: perfektes Schwarz, unendlichen Kontrast und Farben, wie sie die Filmemacher wollten. Der OLED TV 65 ergänzt Next-Gen-Gaming-Funktionen - 120 Hz, VRR und automatischen Low-Latency-Modus - plus einen Prozessor, der alles nahe an 4K-Schärfe heranskaliert.",
      },
      es: {
        title: "Televisor OLED 65",
        short: "Televisor OLED de 65 pulgadas con negros perfectos, color de cine y funciones gaming de nueva generación.",
        desc: "Los píxeles OLED autoiluminados logran lo que el LCD no puede: negros perfectos, contraste infinito y el color que los cineastas concibieron. El televisor OLED 65 añade funciones gaming de nueva generación - 120 Hz, VRR y modo automático de baja latencia - más un procesador que reescala todo lo que ves hasta una nitidez casi 4K.",
      },
    },
  },
  "soundbar-2-1": {
    brand: "sony",
    variants: { mode: "colors", palette: ["black", "gray"] },
    t: {
      en: {
        title: "Soundbar 2.1",
        short: "2.1-channel soundbar with wireless subwoofer that transforms your TV's sound in minutes.",
        desc: "TV speakers cannot do movie sound justice - the Soundbar 2.1 can. The slim bar handles crisp dialogue while the wireless subwoofer adds the rumble movies and games deserve. Setup takes one cable and one power socket, and Bluetooth streaming turns it into your music system between shows.",
      },
      sr: {
        title: "Soundbar 2.1",
        short: "Soundbar sistem 2.1 sa bežičnim subwooferom koji preobrazi zvuk televizora za par minuta.",
        desc: "Zvučnici televizora ne mogu da dočaraju filmski zvuk - Soundbar 2.1 može. Tanka traka zadužena je za kristalno jasne dijaloge, dok bežični subwoofer dodaje tutnjavu kakvu filmovi i igre zaslužuju. Postavljanje traje koliko jedan kabl i jedna utičnica, a Bluetooth striming ga između serija pretvara u muzički sistem.",
      },
      de: {
        title: "Soundbar 2.1",
        short: "2.1-Kanal-Soundbar mit kabellosem Subwoofer, die den TV-Klang in Minuten verwandelt.",
        desc: "Fernseherlautsprecher werden Filmton nicht gerecht - die Soundbar 2.1 schon. Die schlanke Leiste sorgt für klare Dialoge, während der kabellose Subwoofer das Wummern liefert, das Filme und Spiele verdienen. Die Einrichtung braucht ein Kabel und eine Steckdose, und per Bluetooth wird sie zwischendurch zur Musikanlage.",
      },
      es: {
        title: "Barra de sonido 2.1",
        short: "Barra de sonido 2.1 con subwoofer inalámbrico que transforma el sonido de tu tele en minutos.",
        desc: "Los altavoces del televisor no hacen justicia al sonido de cine - la barra de sonido 2.1 sí. La barra fina se encarga de unos diálogos nítidos mientras el subwoofer inalámbrico añade los graves que películas y juegos merecen. La instalación es un cable y un enchufe, y con Bluetooth se convierte en tu equipo de música entre series.",
      },
    },
  },
  "bluetooth-speaker": {
    brand: "sony",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Bluetooth Speaker",
        short: "Rugged portable speaker with surprisingly big sound and 20 hours of playtime.",
        desc: "Small enough for a backpack pocket, loud enough for a garden party. This rugged Bluetooth speaker pushes surprisingly big, room-filling sound, shrugs off splashes and dust with an IP67 rating, and keeps playing for up to 20 hours on a charge. Pair two for instant stereo.",
      },
      sr: {
        title: "Bluetooth zvučnik",
        short: "Otporan prenosivi zvučnik iznenađujuće velikog zvuka i 20 sati rada.",
        desc: "Dovoljno mali za džep ranca, dovoljno glasan za žurku u dvorištu. Ovaj otporni Bluetooth zvučnik isporučuje iznenađujuće veliki zvuk koji puni prostoriju, IP67 sertifikat ga čuva od prskanja i prašine, a baterija svira do 20 sati po punjenju. Uparite dva za trenutni stereo.",
      },
      de: {
        title: "Bluetooth-Lautsprecher",
        short: "Robuster tragbarer Lautsprecher mit überraschend großem Klang und 20 Stunden Laufzeit.",
        desc: "Klein genug für die Rucksacktasche, laut genug für die Gartenparty. Dieser robuste Bluetooth-Lautsprecher liefert überraschend großen, raumfüllenden Klang, trotzt Spritzwasser und Staub nach IP67 und spielt mit einer Ladung bis zu 20 Stunden. Zwei koppeln - fertig ist das Stereo-Paar.",
      },
      es: {
        title: "Altavoz Bluetooth",
        short: "Altavoz portátil resistente con un sonido sorprendentemente grande y 20 horas de reproducción.",
        desc: "Lo bastante pequeño para el bolsillo de la mochila y lo bastante potente para una fiesta en el jardín. Este resistente altavoz Bluetooth ofrece un sonido sorprendentemente amplio, aguanta salpicaduras y polvo con certificación IP67 y reproduce hasta 20 horas por carga. Empareja dos y tendrás estéreo al instante.",
      },
    },
  },
  "wireless-headphones": {
    brand: "sony",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Wireless Headphones",
        short: "Comfortable over-ear wireless headphones with rich sound and 40-hour battery life.",
        desc: "Made for long listening sessions, these wireless over-ear headphones combine plush memory-foam earcups with a balanced, detailed sound signature. The 40-hour battery outlasts intercontinental flights, quick charge adds hours in minutes, and multipoint pairing switches seamlessly between laptop and phone.",
      },
      sr: {
        title: "Bežične slušalice",
        short: "Udobne bežične slušalice preko ušiju sa bogatim zvukom i baterijom od 40 sati.",
        desc: "Stvorene za duge sesije slušanja, ove bežične slušalice preko ušiju kombinuju mekane jastučiće od memorijske pene sa izbalansiranim, detaljnim zvukom. Baterija od 40 sati nadživi i interkontinentalne letove, brzo punjenje dodaje sate za nekoliko minuta, a multipoint uparivanje glatko prebacuje između laptopa i telefona.",
      },
      de: {
        title: "Kabellose Kopfhörer",
        short: "Bequeme kabellose Over-Ear-Kopfhörer mit sattem Klang und 40 Stunden Akkulaufzeit.",
        desc: "Diese kabellosen Over-Ear-Kopfhörer sind für lange Hörsessions gemacht: weiche Memory-Schaum-Polster treffen auf einen ausgewogenen, detailreichen Klang. Der 40-Stunden-Akku überdauert Interkontinentalflüge, Schnellladen bringt in Minuten Stunden dazu, und Multipoint wechselt nahtlos zwischen Laptop und Handy.",
      },
      es: {
        title: "Auriculares inalámbricos",
        short: "Cómodos auriculares inalámbricos de diadema con sonido rico y 40 horas de batería.",
        desc: "Pensados para largas sesiones de escucha, estos auriculares inalámbricos de diadema combinan almohadillas de espuma viscoelástica con un sonido equilibrado y detallado. Su batería de 40 horas supera cualquier vuelo intercontinental, la carga rápida añade horas en minutos y la conexión multipunto alterna sin cortes entre portátil y móvil.",
      },
    },
  },
  "noise-cancel-earbuds": {
    brand: "samsung",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Noise-Cancel Earbuds",
        short: "True wireless earbuds with active noise cancelling and crystal-clear calls.",
        desc: "Silence the commute with true wireless earbuds whose active noise cancelling erases engine hum and office chatter. Transparency mode brings the world back with a tap, triple microphones keep calls clear even on windy streets, and the pocketable case tops the battery up to 24 hours total.",
      },
      sr: {
        title: "Bubice sa redukcijom buke",
        short: "Potpuno bežične bubice sa aktivnom redukcijom buke i kristalno jasnim pozivima.",
        desc: "Utišajte prevoz do posla bubicama čija aktivna redukcija buke briše brujanje motora i kancelarijski žamor. Režim transparentnosti jednim dodirom vraća zvuke okoline, tri mikrofona čuvaju jasnoću poziva i na vetrovitoj ulici, a kutijica za džep dopunjava bateriju do ukupno 24 sata.",
      },
      de: {
        title: "Noise-Cancelling-Earbuds",
        short: "True-Wireless-Ohrhörer mit aktiver Geräuschunterdrückung und glasklaren Anrufen.",
        desc: "Bringen Sie den Pendelverkehr zum Schweigen: Die aktive Geräuschunterdrückung dieser True-Wireless-Ohrhörer löscht Motorbrummen und Bürolärm. Der Transparenzmodus holt die Umgebung per Tipp zurück, drei Mikrofone halten Anrufe auch bei Wind klar, und das Lade-Etui verlängert die Laufzeit auf insgesamt 24 Stunden.",
      },
      es: {
        title: "Auriculares con cancelación de ruido",
        short: "Auriculares true wireless con cancelación activa de ruido y llamadas cristalinas.",
        desc: "Silencia el trayecto al trabajo con unos auriculares true wireless cuya cancelación activa borra el rumor del motor y el bullicio de la oficina. El modo transparencia devuelve el entorno con un toque, sus tres micrófonos mantienen las llamadas claras incluso con viento y el estuche de bolsillo amplía la batería hasta 24 horas en total.",
      },
    },
  },
  "studio-over-ear": {
    brand: "apple",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Studio Over-Ear",
        short: "Premium studio headphones with high-fidelity drivers and spatial audio support.",
        desc: "The Studio Over-Ear headphones are tuned for people who hear the difference: custom high-fidelity drivers reveal detail that lesser headphones smear together, while adaptive EQ adjusts the sound to the fit of the seal. Spatial audio with head tracking places you inside the mix, and the breathable knit headband stays comfortable for hours.",
      },
      sr: {
        title: "Studijske slušalice",
        short: "Premijum studijske slušalice sa hi-fi drajverima i podrškom za prostorni zvuk.",
        desc: "Studijske slušalice naštimovane su za ljude koji čuju razliku: namenski hi-fi drajveri otkrivaju detalje koje slabije slušalice stapaju u jedno, dok adaptivni EQ prilagođava zvuk načinu na koji naležu. Prostorni zvuk sa praćenjem pokreta glave smešta vas usred miksa, a prozračna pletena traka ostaje udobna satima.",
      },
      de: {
        title: "Studio Over-Ear",
        short: "Premium-Studiokopfhörer mit High-Fidelity-Treibern und Unterstützung für 3D-Audio.",
        desc: "Die Studio-Over-Ear-Kopfhörer sind für Menschen abgestimmt, die den Unterschied hören: maßgefertigte High-Fidelity-Treiber legen Details frei, die einfachere Kopfhörer verwischen, während der adaptive EQ den Klang an den Sitz anpasst. 3D-Audio mit Headtracking versetzt Sie mitten in den Mix, und das atmungsaktive Strickkopfband bleibt stundenlang bequem.",
      },
      es: {
        title: "Auriculares de estudio",
        short: "Auriculares de estudio premium con transductores de alta fidelidad y audio espacial.",
        desc: "Los auriculares de estudio están afinados para quienes oyen la diferencia: transductores de alta fidelidad a medida revelan detalles que otros auriculares emborronan, mientras el ecualizador adaptativo ajusta el sonido al sellado de cada oreja. El audio espacial con seguimiento de cabeza te coloca dentro de la mezcla, y la diadema de punto transpirable sigue cómoda durante horas.",
      },
    },
  },
  "mirrorless-camera": {
    brand: "sony",
    variants: { mode: "colors", palette: ["black", "gray"] },
    t: {
      en: {
        title: "Mirrorless Camera",
        short: "Full-frame mirrorless camera with fast autofocus and in-body stabilization.",
        desc: "The Mirrorless Camera puts full-frame image quality into a body half the size of a DSLR. Eye-tracking autofocus nails portraits, five-axis in-body stabilization rescues handheld shots in dim light, and the electronic viewfinder previews your exposure exactly as it will be captured. A serious tool that stays out of your way.",
      },
      sr: {
        title: "Mirrorless kamera",
        short: "Full-frame mirrorless kamera sa brzim autofokusom i stabilizacijom u telu.",
        desc: "Mirrorless kamera smešta full-frame kvalitet slike u telo upola manje od DSLR-a. Autofokus sa praćenjem oka pogađa portrete bez promašaja, petoosna stabilizacija u telu spasava snimke iz ruke pri slabom svetlu, a elektronsko tražilo prikazuje ekspoziciju tačno onako kako će biti snimljena. Ozbiljan alat koji vam ne smeta u radu.",
      },
      de: {
        title: "Spiegellose Kamera",
        short: "Spiegellose Vollformatkamera mit schnellem Autofokus und integrierter Bildstabilisierung.",
        desc: "Die spiegellose Kamera bringt Vollformat-Bildqualität in ein Gehäuse, das halb so groß ist wie eine DSLR. Der Augen-Autofokus trifft Porträts zuverlässig, die 5-Achsen-Stabilisierung rettet Freihandaufnahmen bei wenig Licht, und der elektronische Sucher zeigt die Belichtung exakt so, wie sie aufgenommen wird. Ein ernsthaftes Werkzeug, das nicht im Weg steht.",
      },
      es: {
        title: "Cámara sin espejo",
        short: "Cámara sin espejo de formato completo con enfoque rápido y estabilización integrada.",
        desc: "La cámara sin espejo mete la calidad de imagen de formato completo en un cuerpo la mitad de grande que una réflex. El autofoco con seguimiento ocular clava los retratos, la estabilización de cinco ejes salva las fotos a pulso con poca luz y el visor electrónico muestra la exposición exactamente como quedará. Una herramienta seria que no estorba.",
      },
    },
  },
  "dslr-kit": {
    brand: "canon",
    variants: { mode: "colors", palette: ["black"] },
    t: {
      en: {
        title: "DSLR Kit",
        short: "Complete DSLR starter kit with an 18-55mm lens - everything you need to learn photography.",
        desc: "Everything a beginning photographer needs in one box: a dependable DSLR body, a versatile 18-55mm zoom lens, battery, charger and strap. The optical viewfinder teaches you to see light the way film shooters did, guided menus explain each setting as you go, and the huge lens ecosystem leaves endless room to grow.",
      },
      sr: {
        title: "DSLR komplet",
        short: "Kompletan DSLR početni komplet sa objektivom 18-55mm - sve što treba za učenje fotografije.",
        desc: "Sve što je fotografu početniku potrebno u jednoj kutiji: pouzdano DSLR telo, svestrani zum objektiv 18-55mm, baterija, punjač i remen. Optičko tražilo uči vas da vidite svetlo kao filmski fotografi, vođeni meniji objašnjavaju svako podešavanje u hodu, a ogroman izbor objektiva ostavlja beskrajno prostora za napredovanje.",
      },
      de: {
        title: "DSLR-Kit",
        short: "Komplettes DSLR-Einsteigerkit mit 18-55mm-Objektiv - alles zum Fotografieren lernen.",
        desc: "Alles, was Fotografie-Einsteiger brauchen, in einer Box: ein zuverlässiges DSLR-Gehäuse, ein vielseitiges 18-55mm-Zoomobjektiv, Akku, Ladegerät und Gurt. Der optische Sucher lehrt Sie, Licht zu sehen wie die Analogfotografen, geführte Menüs erklären jede Einstellung unterwegs, und das riesige Objektiv-Ökosystem lässt endlos Raum zum Wachsen.",
      },
      es: {
        title: "Kit réflex DSLR",
        short: "Kit réflex completo para empezar con objetivo 18-55mm - todo lo necesario para aprender fotografía.",
        desc: "Todo lo que necesita un fotógrafo principiante en una caja: un cuerpo réflex fiable, un versátil objetivo zoom 18-55mm, batería, cargador y correa. El visor óptico te enseña a ver la luz como los fotógrafos de película, los menús guiados explican cada ajuste sobre la marcha y el enorme ecosistema de objetivos deja espacio infinito para crecer.",
      },
    },
  },
  "action-camera-4k": {
    brand: "sony",
    variants: { mode: "colors", palette: ["black", "gray"] },
    t: {
      en: {
        title: "Action Camera 4K",
        short: "Waterproof 4K action camera with rock-steady stabilization for sports and adventures.",
        desc: "Strap it to a helmet, a handlebar or your chest - the Action Camera 4K captures buttery-smooth 4K footage through jumps, drops and waves. It is waterproof to 10 meters without a case, the advanced stabilization irons out even mountain-bike chatter, and voice commands start recording when your hands are busy.",
      },
      sr: {
        title: "Akciona kamera 4K",
        short: "Vodootporna 4K akciona kamera sa čvrstom stabilizacijom za sport i avanture.",
        desc: "Zakačite je na kacigu, upravljač ili grudi - Akciona kamera 4K snima savršeno gladak 4K materijal kroz skokove, padove i talase. Vodootporna je do 10 metara bez kućišta, napredna stabilizacija pegla čak i vibracije brdskog bicikla, a glasovne komande pokreću snimanje kada su vam ruke zauzete.",
      },
      de: {
        title: "Action-Kamera 4K",
        short: "Wasserdichte 4K-Action-Kamera mit felsenfester Stabilisierung für Sport und Abenteuer.",
        desc: "An Helm, Lenker oder Brustgurt - die Action-Kamera 4K filmt butterweiches 4K-Material durch Sprünge, Stürze und Wellen. Ohne Gehäuse bis 10 Meter wasserdicht, bügelt die fortschrittliche Stabilisierung selbst Mountainbike-Vibrationen aus, und Sprachbefehle starten die Aufnahme, wenn die Hände voll sind.",
      },
      es: {
        title: "Cámara de acción 4K",
        short: "Cámara de acción 4K sumergible con estabilización sólida para deporte y aventuras.",
        desc: "Móntala en el casco, el manillar o el pecho - la cámara de acción 4K graba imágenes 4K suavísimas entre saltos, caídas y olas. Es sumergible hasta 10 metros sin carcasa, su estabilización avanzada elimina hasta la vibración de la bici de montaña y los comandos de voz inician la grabación cuando tienes las manos ocupadas.",
      },
    },
  },
  "vlogging-camera": {
    brand: "canon",
    variants: { mode: "colors", palette: ["black", "white"] },
    t: {
      en: {
        title: "Vlogging Camera",
        short: "Compact vlogging camera with a flip screen, clean audio and one-tap background blur.",
        desc: "Designed for creators, the Vlogging Camera flips its screen forward so you can frame yourself perfectly, keeps your voice clear with a directional microphone and wind muff, and blurs the background with one tap for that professional look. Livestream over USB without any capture card.",
      },
      sr: {
        title: "Vlog kamera",
        short: "Kompaktna vlog kamera sa preklopnim ekranom, čistim zvukom i zamućenjem pozadine na dodir.",
        desc: "Dizajnirana za kreatore, Vlog kamera okreće ekran napred da se savršeno ukadrirate, čuva glas jasnim pomoću usmerenog mikrofona sa zaštitom od vetra i jednim dodirom zamućuje pozadinu za profesionalan izgled. Strimujte uživo preko USB-a bez ikakve kartice za snimanje.",
      },
      de: {
        title: "Vlogging-Kamera",
        short: "Kompakte Vlogging-Kamera mit Klappdisplay, sauberem Ton und Hintergrundunschärfe per Tipp.",
        desc: "Die Vlogging-Kamera ist für Creator gemacht: Das nach vorn klappbare Display sorgt für den perfekten Bildausschnitt, ein Richtmikrofon mit Windschutz hält die Stimme klar, und ein Tipp genügt für professionelle Hintergrundunschärfe. Livestreaming läuft direkt über USB - ganz ohne Capture-Karte.",
      },
      es: {
        title: "Cámara para vlogs",
        short: "Cámara compacta para vlogs con pantalla abatible, audio limpio y desenfoque de fondo con un toque.",
        desc: "Diseñada para creadores, la cámara para vlogs gira su pantalla hacia delante para que te encuadres a la perfección, mantiene tu voz clara con un micrófono direccional con paraviento y desenfoca el fondo con un toque para ese acabado profesional. Emite en directo por USB sin capturadora.",
      },
    },
  },
  "game-console-x": {
    brand: "sony",
    variants: { mode: "colors", palette: ["black", "white"] },
    t: {
      en: {
        title: "Game Console X",
        short: "Next-generation game console with 4K gaming, ray tracing and near-instant load times.",
        desc: "The Game Console X loads worlds in seconds thanks to its custom SSD, renders them in 4K with ray-traced lighting and keeps frame rates high where it counts. The redesigned controller adds adaptive triggers and refined haptics that let you feel the road, the rain and the recoil.",
      },
      sr: {
        title: "Konzola X",
        short: "Konzola nove generacije sa 4K igranjem, ray tracing-om i skoro trenutnim učitavanjem.",
        desc: "Konzola X učitava svetove za nekoliko sekundi zahvaljujući namenskom SSD-u, prikazuje ih u 4K sa ray-traced osvetljenjem i drži visok broj frejmova tamo gde je najvažnije. Redizajnirani kontroler dodaje adaptivne okidače i istančane vibracije kroz koje osećate put, kišu i trzaj.",
      },
      de: {
        title: "Spielkonsole X",
        short: "Next-Gen-Konsole mit 4K-Gaming, Raytracing und nahezu sofortigen Ladezeiten.",
        desc: "Die Spielkonsole X lädt Welten dank ihrer maßgeschneiderten SSD in Sekunden, rendert sie in 4K mit Raytracing-Beleuchtung und hält die Bildraten hoch, wo es zählt. Der neu gestaltete Controller bringt adaptive Trigger und feine Haptik, mit der Sie Straße, Regen und Rückstoß spüren.",
      },
      es: {
        title: "Consola X",
        short: "Consola de nueva generación con juego en 4K, ray tracing y cargas casi instantáneas.",
        desc: "La consola X carga mundos en segundos gracias a su SSD a medida, los renderiza en 4K con iluminación por ray tracing y mantiene altas las tasas de fotogramas donde importa. Su mando rediseñado añade gatillos adaptativos y una háptica refinada con la que sientes la carretera, la lluvia y el retroceso.",
      },
    },
  },
  "wireless-controller": {
    brand: "sony",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Wireless Controller",
        short: "Ergonomic wireless controller with haptic feedback and a 30-hour battery.",
        desc: "Sculpted to disappear into your hands, the Wireless Controller pairs precise sticks and a responsive d-pad with rich haptic feedback that brings games to life. The battery lasts through 30 hours of play, and it hops between console, PC and phone with a quick pairing shortcut.",
      },
      sr: {
        title: "Bežični kontroler",
        short: "Ergonomski bežični kontroler sa haptičkim odzivom i baterijom od 30 sati.",
        desc: "Oblikovan da nestane u rukama, Bežični kontroler spaja precizne palice i responzivan d-pad sa bogatim haptičkim odzivom koji oživljava igre. Baterija izdrži 30 sati igranja, a prečicom za uparivanje skače između konzole, računara i telefona.",
      },
      de: {
        title: "Wireless-Controller",
        short: "Ergonomischer kabelloser Controller mit haptischem Feedback und 30 Stunden Akku.",
        desc: "Der Wireless-Controller schmiegt sich in die Hände: präzise Sticks und ein reaktionsschnelles Steuerkreuz treffen auf sattes haptisches Feedback, das Spiele lebendig macht. Der Akku hält 30 Stunden durch, und per Pairing-Shortcut wechselt er flink zwischen Konsole, PC und Smartphone.",
      },
      es: {
        title: "Mando inalámbrico",
        short: "Mando inalámbrico ergonómico con respuesta háptica y batería de 30 horas.",
        desc: "Esculpido para desaparecer entre tus manos, el mando inalámbrico combina sticks precisos y una cruceta reactiva con una respuesta háptica rica que da vida a los juegos. La batería aguanta 30 horas de partida y salta entre consola, PC y móvil con un atajo de emparejamiento.",
      },
    },
  },
  "gaming-headset": {
    brand: "lenovo",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Gaming Headset",
        short: "Surround-sound gaming headset with a noise-cancelling mic and all-night comfort.",
        desc: "Hear footsteps before you see them: the Gaming Headset's virtual surround sound gives you a competitive edge, while the broadcast-quality noise-cancelling microphone keeps your callouts clean. Cooling gel ear cushions and a suspension headband stay comfortable deep into the night.",
      },
      sr: {
        title: "Gejming slušalice",
        short: "Gejming slušalice sa surround zvukom, mikrofonom sa redukcijom buke i udobnošću za celu noć.",
        desc: "Čujte korake pre nego što ih vidite: virtuelni surround zvuk daje vam takmičarsku prednost, dok mikrofon studijskog kvaliteta sa redukcijom buke drži vaše pozive čistim. Jastučići sa rashladnim gelom i viseća traka ostaju udobni duboko u noć.",
      },
      de: {
        title: "Gaming-Headset",
        short: "Gaming-Headset mit Surround-Sound, Noise-Cancelling-Mikrofon und Komfort für lange Nächte.",
        desc: "Hören Sie Schritte, bevor Sie sie sehen: Der virtuelle Surround-Sound des Gaming-Headsets verschafft einen Wettbewerbsvorteil, während das Noise-Cancelling-Mikrofon in Broadcast-Qualität Ihre Ansagen sauber hält. Gel-gekühlte Ohrpolster und ein Federkopfband bleiben bis tief in die Nacht bequem.",
      },
      es: {
        title: "Auriculares gaming",
        short: "Auriculares gaming con sonido envolvente, micrófono con cancelación de ruido y comodidad para toda la noche.",
        desc: "Oye los pasos antes de verlos: el sonido envolvente virtual de estos auriculares gaming te da ventaja competitiva, mientras su micrófono con cancelación de ruido de calidad broadcast mantiene limpias tus indicaciones. Las almohadillas de gel refrescante y la diadema suspendida siguen cómodas hasta bien entrada la noche.",
      },
    },
  },
  "mechanical-keyboard": {
    brand: "lenovo",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Mechanical Keyboard",
        short: "Hot-swappable mechanical keyboard with PBT keycaps and per-key RGB lighting.",
        desc: "Typing you can feel and hear - or not, your choice. This mechanical keyboard ships with crisp tactile switches you can hot-swap without soldering, durable PBT keycaps that never shine, and per-key RGB you can tune or turn off. Triple-mode connectivity covers cable, 2.4 GHz dongle and Bluetooth.",
      },
      sr: {
        title: "Mehanička tastatura",
        short: "Mehanička tastatura sa zamenljivim prekidačima, PBT kapicama i RGB osvetljenjem po tasteru.",
        desc: "Kucanje koje se oseća i čuje - ili ne, po vašem izboru. Ova mehanička tastatura stiže sa preciznim taktilnim prekidačima koje menjate bez lemljenja, izdržljivim PBT kapicama koje se nikada ne glancaju i RGB osvetljenjem po tasteru koje možete podesiti ili ugasiti. Tri režima povezivanja: kabl, 2,4 GHz prijemnik i Bluetooth.",
      },
      de: {
        title: "Mechanische Tastatur",
        short: "Mechanische Hot-Swap-Tastatur mit PBT-Tastenkappen und RGB-Beleuchtung pro Taste.",
        desc: "Tippen, das man fühlt und hört - oder eben nicht, ganz nach Wunsch. Diese mechanische Tastatur kommt mit knackigen taktilen Switches zum Wechseln ohne Löten, langlebigen PBT-Tastenkappen, die nie speckig werden, und RGB pro Taste zum Anpassen oder Abschalten. Drei Verbindungsarten: Kabel, 2,4-GHz-Dongle und Bluetooth.",
      },
      es: {
        title: "Teclado mecánico",
        short: "Teclado mecánico hot-swap con teclas PBT e iluminación RGB por tecla.",
        desc: "Una escritura que se siente y se oye - o no, tú eliges. Este teclado mecánico llega con interruptores táctiles intercambiables sin soldadura, teclas de PBT duraderas que nunca se pulen y RGB por tecla que puedes ajustar o apagar. Su triple conectividad cubre cable, receptor de 2,4 GHz y Bluetooth.",
      },
    },
  },
  "dash-cam-1080p": {
    brand: "sony",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Dash Cam 1080p",
        short: "Compact 1080p dash cam with night vision, loop recording and automatic incident lock.",
        desc: "Silent witness on every drive: the Dash Cam 1080p records sharp full-HD video with clear plates by day and usable detail at night. Loop recording manages storage automatically, while the G-sensor locks footage the moment an impact is detected. The discreet mount tucks behind the mirror.",
      },
      sr: {
        title: "Auto kamera 1080p",
        short: "Kompaktna auto kamera 1080p sa noćnim snimanjem, snimanjem u petlji i automatskim zaključavanjem nezgoda.",
        desc: "Nemi svedok svake vožnje: Auto kamera 1080p snima oštar full-HD video sa čitljivim tablicama danju i upotrebljivim detaljima noću. Snimanje u petlji samo upravlja memorijom, dok G-senzor zaključava snimak čim detektuje udar. Diskretan nosač staje iza retrovizora.",
      },
      de: {
        title: "Dashcam 1080p",
        short: "Kompakte 1080p-Dashcam mit Nachtsicht, Schleifenaufnahme und automatischer Unfallsicherung.",
        desc: "Stiller Zeuge auf jeder Fahrt: Die Dashcam 1080p filmt scharfes Full-HD-Video mit lesbaren Kennzeichen bei Tag und brauchbaren Details bei Nacht. Die Schleifenaufnahme verwaltet den Speicher automatisch, während der G-Sensor die Aufnahme im Moment eines Aufpralls sichert. Die dezente Halterung verschwindet hinter dem Spiegel.",
      },
      es: {
        title: "Cámara de salpicadero 1080p",
        short: "Cámara de coche compacta 1080p con visión nocturna, grabación en bucle y bloqueo automático de incidentes.",
        desc: "Testigo silencioso en cada trayecto: la cámara de salpicadero 1080p graba vídeo full-HD nítido con matrículas legibles de día y detalle aprovechable de noche. La grabación en bucle gestiona la memoria sola, mientras el sensor G bloquea las imágenes en cuanto detecta un impacto. Su soporte discreto se esconde tras el retrovisor.",
      },
    },
  },
  "car-bluetooth-adapter": {
    brand: "sony",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Car Bluetooth Adapter",
        short: "Plug-in Bluetooth adapter that adds wireless music and hands-free calls to any car.",
        desc: "Give an older car modern audio in thirty seconds: the adapter plugs into the 12V socket, pairs with your phone over Bluetooth and streams music through the FM radio or AUX input. A built-in microphone enables hands-free calling, and two USB ports fast-charge your devices on the go.",
      },
      sr: {
        title: "Auto Bluetooth adapter",
        short: "Bluetooth adapter koji svakom autu dodaje bežičnu muziku i pozive bez ruku.",
        desc: "Podarite starijem autu moderan zvuk za trideset sekundi: adapter se uključuje u 12V utičnicu, uparuje sa telefonom preko Bluetooth-a i pušta muziku kroz FM radio ili AUX ulaz. Ugrađeni mikrofon omogućava razgovore bez ruku, a dva USB porta usput brzo pune vaše uređaje.",
      },
      de: {
        title: "Auto-Bluetooth-Adapter",
        short: "Bluetooth-Adapter zum Einstecken für kabellose Musik und Freisprechen in jedem Auto.",
        desc: "Verpassen Sie einem älteren Auto in dreißig Sekunden modernes Audio: Der Adapter steckt in der 12V-Buchse, koppelt sich per Bluetooth mit dem Handy und überträgt Musik über FM-Radio oder AUX-Eingang. Das eingebaute Mikrofon ermöglicht Freisprechen, und zwei USB-Ports laden unterwegs schnell.",
      },
      es: {
        title: "Adaptador Bluetooth para coche",
        short: "Adaptador Bluetooth enchufable que añade música inalámbrica y manos libres a cualquier coche.",
        desc: "Dale a un coche veterano audio moderno en treinta segundos: el adaptador se enchufa a la toma de 12V, se empareja con tu móvil por Bluetooth y reproduce música a través de la radio FM o la entrada AUX. Su micrófono integrado permite llamadas manos libres y dos puertos USB cargan rápido tus dispositivos en marcha.",
      },
    },
  },
};
