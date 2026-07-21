import type { ProductContent } from "./types";

// Home & Garden (furniture, kitchen, decor), tools and Sports & Outdoors.

export const homeSports: Record<string, ProductContent> = {
  "oak-coffee-table": {
    brand: "ikea",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Oak Coffee Table",
        short: "Solid oak coffee table with a lower shelf - warm, sturdy and timeless.",
        desc: "Built from solid oak with visible grain that makes every table unique, this coffee table anchors a living room without shouting. The lower shelf keeps magazines and remotes off the top, rounded corners are kind to shins and toddlers, and the oiled finish is easily refreshed for decades of use.",
      },
      sr: {
        title: "Hrastov sto za dnevnu sobu",
        short: "Sto za dnevnu sobu od punog hrasta sa donjom policom - topao, čvrst i bezvremenski.",
        desc: "Napravljen od punog hrasta sa vidljivim godovima koji svaki sto čine jedinstvenim, ovaj sto usidri dnevnu sobu bez razmetanja. Donja polica sklanja časopise i daljinske sa ploče, zaobljeni uglovi blagi su prema cevanicama i mališanima, a uljani premaz lako se obnavlja za decenije upotrebe.",
      },
      de: {
        title: "Couchtisch aus Eiche",
        short: "Couchtisch aus massiver Eiche mit Ablageboden - warm, stabil und zeitlos.",
        desc: "Gefertigt aus massiver Eiche mit sichtbarer Maserung, die jeden Tisch zum Unikat macht, verankert dieser Couchtisch das Wohnzimmer, ohne aufzutrumpfen. Der untere Ablageboden hält Zeitschriften und Fernbedienungen von der Platte fern, abgerundete Ecken schonen Schienbeine und Kleinkinder, und das geölte Finish lässt sich für Jahrzehnte der Nutzung leicht auffrischen.",
      },
      es: {
        title: "Mesa de centro de roble",
        short: "Mesa de centro de roble macizo con balda inferior - cálida, robusta y atemporal.",
        desc: "Construida en roble macizo con una veta visible que hace única cada mesa, esta mesa de centro ancla el salón sin estridencias. La balda inferior aparta revistas y mandos de la superficie, las esquinas redondeadas cuidan espinillas y niños pequeños, y el acabado al aceite se renueva fácilmente para décadas de uso.",
      },
    },
  },
  "fabric-sofa-3-seat": {
    brand: "ikea",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Fabric Sofa 3-Seat",
        short: "Deep three-seater sofa with washable covers and pocket-spring comfort.",
        desc: "The sofa the whole family argues over: deep seats with pocket springs that support without swallowing, wide armrests at coffee-cup height, and covers that zip off for machine washing - a lifesaver with kids and pets. The sturdy hardwood frame is built for years of movie nights.",
      },
      sr: {
        title: "Trosed od tkanine",
        short: "Dubok trosed sa perivim navlakama i udobnošću džepičastih opruga.",
        desc: "Sofa oko koje se cela porodica otima: duboka sedišta sa džepičastim oprugama koje pridržavaju a ne gutaju, široki nasloni za ruke na visini šoljice kafe i navlake koje se skidaju rajsferšlusom za mašinsko pranje - spas sa decom i ljubimcima. Čvrst ram od tvrdog drveta građen je za godine filmskih večeri.",
      },
      de: {
        title: "3-Sitzer-Stoffsofa",
        short: "Tiefes Dreisitzer-Sofa mit waschbaren Bezügen und Taschenfederkern-Komfort.",
        desc: "Das Sofa, um das die ganze Familie streitet: tiefe Sitze mit Taschenfederkern, der stützt, ohne zu verschlucken, breite Armlehnen auf Kaffeetassenhöhe und Bezüge mit Reißverschluss für die Waschmaschine - ein Segen mit Kindern und Haustieren. Das stabile Hartholzgestell ist für Jahre voller Filmabende gebaut.",
      },
      es: {
        title: "Sofá de tela de 3 plazas",
        short: "Sofá profundo de tres plazas con fundas lavables y confort de muelles ensacados.",
        desc: "El sofá por el que discute toda la familia: asientos profundos con muelles ensacados que sujetan sin tragarte, reposabrazos anchos a la altura de la taza de café y fundas con cremallera lavables a máquina - una salvación con niños y mascotas. Su robusta estructura de madera dura está hecha para años de noches de cine.",
      },
    },
  },
  "ergonomic-office-chair": {
    brand: "ikea",
    variants: { mode: "colors", palette: ["black", "gray", "white"] },
    t: {
      en: {
        title: "Ergonomic Office Chair",
        short: "Fully adjustable ergonomic chair with lumbar support and a breathable mesh back.",
        desc: "Your back keeps score of every workday - the Ergonomic Office Chair helps it win. Adjustable lumbar support, seat depth, armrests and tilt tension dial in your exact posture, while the breathable mesh back keeps you cool through long afternoons. Certified for eight-hour daily use.",
      },
      sr: {
        title: "Ergonomska kancelarijska stolica",
        short: "Potpuno podesiva ergonomska stolica sa lumbalnom podrškom i prozračnim mrežastim naslonom.",
        desc: "Vaša leđa pamte svaki radni dan - Ergonomska kancelarijska stolica pomaže im da pobede. Podesiva lumbalna podrška, dubina sedišta, nasloni za ruke i otpor ljuljanja precizno se štimuju uz vaše držanje, dok prozračni mrežasti naslon hladi tokom dugih popodneva. Sertifikovana za osmočasovnu dnevnu upotrebu.",
      },
      de: {
        title: "Ergonomischer Bürostuhl",
        short: "Voll verstellbarer ergonomischer Stuhl mit Lendenstütze und atmungsaktiver Netzlehne.",
        desc: "Ihr Rücken führt Buch über jeden Arbeitstag - der ergonomische Bürostuhl hilft ihm zu gewinnen. Verstellbare Lendenstütze, Sitztiefe, Armlehnen und Neigungswiderstand stellen exakt Ihre Haltung ein, während die atmungsaktive Netzlehne auch lange Nachmittage kühl hält. Zertifiziert für den täglichen Acht-Stunden-Einsatz.",
      },
      es: {
        title: "Silla de oficina ergonómica",
        short: "Silla ergonómica totalmente ajustable con soporte lumbar y respaldo de malla transpirable.",
        desc: "Tu espalda lleva la cuenta de cada jornada - la silla de oficina ergonómica la ayuda a ganar. El soporte lumbar, la profundidad del asiento, los reposabrazos y la tensión de inclinación se ajustan a tu postura exacta, mientras el respaldo de malla transpirable te mantiene fresco en las tardes largas. Certificada para uso diario de ocho horas.",
      },
    },
  },
  "bookshelf-5-tier": {
    brand: "ikea",
    variants: { mode: "colors", palette: ["black", "white", "gray"] },
    t: {
      en: {
        title: "Bookshelf 5-Tier",
        short: "Five roomy shelves with an anti-tip kit - a home for books, plants and memories.",
        desc: "Five deep shelves hold everything from paperbacks to record collections, with adjustable feet for uneven floors and an included anti-tip kit for peace of mind with children around. The clean-lined frame assembles in under an hour and looks right in a study, living room or hallway.",
      },
      sr: {
        title: "Polica za knjige 5 nivoa",
        short: "Pet prostranih polica sa setom protiv prevrtanja - dom za knjige, biljke i uspomene.",
        desc: "Pet dubokih polica prima sve od džepnih izdanja do kolekcije ploča, uz podesive nožice za neravne podove i priloženi set protiv prevrtanja za miran san kada su deca u blizini. Ram čistih linija sklapa se za manje od sat vremena i dobro stoji u radnoj, dnevnoj sobi ili hodniku.",
      },
      de: {
        title: "Bücherregal 5 Böden",
        short: "Fünf geräumige Böden mit Kippsicherung - ein Zuhause für Bücher, Pflanzen und Erinnerungen.",
        desc: "Fünf tiefe Böden fassen alles vom Taschenbuch bis zur Plattensammlung, mit verstellbaren Füßen für unebene Böden und beiliegender Kippsicherung für ein gutes Gefühl mit Kindern im Haus. Das klar gezeichnete Gestell ist in unter einer Stunde aufgebaut und passt ins Arbeitszimmer, Wohnzimmer oder den Flur.",
      },
      es: {
        title: "Estantería de 5 baldas",
        short: "Cinco baldas amplias con kit antivuelco - un hogar para libros, plantas y recuerdos.",
        desc: "Cinco baldas profundas acogen desde libros de bolsillo hasta colecciones de vinilos, con pies regulables para suelos irregulares y kit antivuelco incluido para estar tranquilo con niños cerca. La estructura de líneas limpias se monta en menos de una hora y queda bien en el estudio, el salón o el recibidor.",
      },
    },
  },
  "non-stick-pan-set": {
    brand: "ikea",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Non-Stick Pan Set",
        short: "Three-piece non-stick pan set with stay-cool handles, safe for all hobs including induction.",
        desc: "Eggs that slide, crepes that flip, cleanup that takes seconds: this three-piece set covers 20, 24 and 28 cm pans with a durable PFOA-free non-stick coating. Stay-cool handles and even heat distribution make cooking calmer, and every pan works on induction, gas and ceramic hobs.",
      },
      sr: {
        title: "Set tiganja sa neprijanjajućim slojem",
        short: "Trodelni set neprijanjajućih tiganja sa hladnim drškama, za sve ploče uključujući indukciju.",
        desc: "Jaja koja klize, palačinke koje se prevrću, pranje koje traje sekunde: ovaj trodelni set pokriva tiganje od 20, 24 i 28 cm sa izdržljivim neprijanjajućim slojem bez PFOA. Drške koje se ne greju i ravnomerno raspoređivanje toplote čine kuvanje mirnijim, a svaki tiganj radi na indukciji, plinu i keramičkim pločama.",
      },
      de: {
        title: "Antihaft-Pfannenset",
        short: "Dreiteiliges Antihaft-Pfannenset mit kühl bleibenden Griffen, für alle Herde inklusive Induktion.",
        desc: "Eier, die rutschen, Crêpes, die sich wenden lassen, Abwasch in Sekunden: Dieses dreiteilige Set umfasst Pfannen mit 20, 24 und 28 cm und einer langlebigen PFOA-freien Antihaftbeschichtung. Kühl bleibende Griffe und gleichmäßige Wärmeverteilung machen das Kochen entspannter, und jede Pfanne funktioniert auf Induktion, Gas und Ceran.",
      },
      es: {
        title: "Set de sartenes antiadherentes",
        short: "Set de tres sartenes antiadherentes con mangos fríos, aptas para todas las cocinas incluida inducción.",
        desc: "Huevos que se deslizan, crepes que se voltean y una limpieza de segundos: este set de tres piezas incluye sartenes de 20, 24 y 28 cm con un recubrimiento antiadherente duradero sin PFOA. Los mangos que no se calientan y el reparto uniforme del calor hacen la cocina más tranquila, y todas funcionan en inducción, gas y vitrocerámica.",
      },
    },
  },
  "stainless-knife-block": {
    brand: "ikea",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Stainless Knife Block",
        short: "Six forged stainless knives in a wooden block - sharp from the box, easy to keep sharp.",
        desc: "One block, every cut covered: chef's, bread, carving, utility and paring knives plus sharpening steel, all forged from a single piece of stainless steel for balance that does the work for you. The full tang and riveted handles survive decades, and the wooden block keeps edges protected between meals.",
      },
      sr: {
        title: "Blok noževa od nerđajućeg čelika",
        short: "Šest kovanih noževa od nerđajućeg čelika u drvenom bloku - oštri iz kutije, laki za održavanje.",
        desc: "Jedan blok, svaki rez pokriven: kuvarski nož, nož za hleb, za tranžiranje, univerzalni i nož za ljuštenje plus šipka za oštrenje, svi kovani iz jednog komada nerđajućeg čelika za balans koji radi umesto vas. Puni trn i zakovane drške traju decenijama, a drveni blok čuva sečiva između obroka.",
      },
      de: {
        title: "Messerblock aus Edelstahl",
        short: "Sechs geschmiedete Edelstahlmesser im Holzblock - scharf ab Werk, leicht scharf zu halten.",
        desc: "Ein Block, jeder Schnitt abgedeckt: Koch-, Brot-, Tranchier-, Allzweck- und Schälmesser plus Wetzstahl, alle aus einem Stück Edelstahl geschmiedet für eine Balance, die die Arbeit für Sie erledigt. Durchgehender Erl und vernietete Griffe halten Jahrzehnte, und der Holzblock schützt die Klingen zwischen den Mahlzeiten.",
      },
      es: {
        title: "Taco de cuchillos de acero inoxidable",
        short: "Seis cuchillos forjados de acero inoxidable en taco de madera - afilados de fábrica y fáciles de mantener.",
        desc: "Un taco y todos los cortes cubiertos: cuchillo de chef, de pan, de trinchar, multiusos y puntilla más chaira, todos forjados de una sola pieza de acero inoxidable con un equilibrio que trabaja por ti. La espiga completa y los mangos remachados duran décadas, y el taco de madera protege los filos entre comidas.",
      },
    },
  },
  "espresso-machine": {
    brand: "bosch",
    variants: { mode: "colors", palette: ["black", "white", "gray"] },
    t: {
      en: {
        title: "Espresso Machine",
        short: "15-bar espresso machine with a steam wand - café-quality shots at home.",
        desc: "Skip the queue and pull café-quality shots in your kitchen: 15 bars of pressure extract rich crema, the steam wand textures silky microfoam for flat whites, and the cup warmer keeps porcelain at the right temperature. Thermoblock heating means espresso in under a minute from switch-on.",
      },
      sr: {
        title: "Espreso aparat",
        short: "Espreso aparat od 15 bara sa ručicom za paru - kafa kao iz kafića, kod kuće.",
        desc: "Preskočite red i izvucite espreso kao iz kafića u svojoj kuhinji: 15 bara pritiska izvlači bogatu kremu, ručica za paru pravi svilenkastu mikropenu za flat white, a grejač šoljica drži porcelan na pravoj temperaturi. Thermoblock grejanje znači espreso za manje od minut od uključivanja.",
      },
      de: {
        title: "Espressomaschine",
        short: "15-bar-Espressomaschine mit Dampflanze - Espresso in Café-Qualität für zu Hause.",
        desc: "Sparen Sie sich die Schlange und beziehen Sie Espresso in Café-Qualität in der eigenen Küche: 15 bar Druck holen eine satte Crema heraus, die Dampflanze zaubert seidigen Mikroschaum für Flat Whites, und der Tassenwärmer hält das Porzellan auf Temperatur. Dank Thermoblock gibt es Espresso in unter einer Minute nach dem Einschalten.",
      },
      es: {
        title: "Cafetera espresso",
        short: "Cafetera espresso de 15 bares con vaporizador - café de cafetería en casa.",
        desc: "Sáltate la cola y prepara espressos de cafetería en tu cocina: 15 bares de presión extraen una crema rica, el vaporizador texturiza microespuma sedosa para flat whites y el calientatazas mantiene la porcelana a la temperatura justa. El calentamiento thermoblock significa espresso en menos de un minuto desde el encendido.",
      },
    },
  },
  "ceramic-dinnerware-set": {
    brand: "ikea",
    variants: { mode: "colors", palette: ["white", "gray", "blue"] },
    t: {
      en: {
        title: "Ceramic Dinnerware Set",
        short: "16-piece stoneware dinnerware set with a hand-glazed finish - dishwasher and microwave safe.",
        desc: "Service for four with room to mix and match: sixteen pieces of sturdy stoneware with a hand-glazed finish that makes every plate subtly unique. The chip-resistant edges survive daily stacking, and everything goes in the dishwasher, microwave and oven up to 220°C.",
      },
      sr: {
        title: "Keramički set posuđa",
        short: "Set posuđa od kamenine od 16 delova sa ručno glaziranom završnicom - za mašinu i mikrotalasnu.",
        desc: "Servis za četvoro sa prostorom za kombinovanje: šesnaest komada čvrste kamenine sa ručno glaziranom završnicom koja svaki tanjir čini suptilno jedinstvenim. Ivice otporne na okrnjavanje preživljavaju svakodnevno slaganje, a sve ide u mašinu za sudove, mikrotalasnu i rernu do 220°C.",
      },
      de: {
        title: "Keramik-Geschirrset",
        short: "16-teiliges Steinzeug-Geschirrset mit handglasiertem Finish - spülmaschinen- und mikrowellenfest.",
        desc: "Service für vier mit Spielraum zum Kombinieren: sechzehn Teile robustes Steinzeug mit handglasiertem Finish, das jeden Teller dezent einzigartig macht. Die stoßfesten Kanten überstehen tägliches Stapeln, und alles darf in Spülmaschine, Mikrowelle und Backofen bis 220°C.",
      },
      es: {
        title: "Vajilla de cerámica",
        short: "Vajilla de gres de 16 piezas con acabado esmaltado a mano - apta para lavavajillas y microondas.",
        desc: "Servicio para cuatro con margen para combinar: dieciséis piezas de gres resistente con un esmaltado a mano que hace cada plato sutilmente único. Los bordes resistentes a mellas soportan el apilado diario, y todo va al lavavajillas, al microondas y al horno hasta 220°C.",
      },
    },
  },
  "woven-wall-art": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Woven Wall Art",
        short: "Handwoven cotton wall hanging that brings warmth and texture to any room.",
        desc: "Handwoven from natural cotton on a wooden dowel, this wall hanging adds the texture a room of flat surfaces is missing. The neutral palette complements any wall color, and at nearly a meter tall it anchors a bedroom, hallway or reading corner without overpowering it.",
      },
      sr: {
        title: "Tkani zidni ukras",
        short: "Ručno tkana zidna dekoracija od pamuka koja unosi toplinu i teksturu u svaki prostor.",
        desc: "Ručno tkana od prirodnog pamuka na drvenom nosaču, ova zidna dekoracija dodaje teksturu koja prostoriji ravnih površina nedostaje. Neutralna paleta slaže se sa svakom bojom zida, a sa skoro metar visine usidri spavaću sobu, hodnik ili kutak za čitanje bez nametanja.",
      },
      de: {
        title: "Gewebte Wanddeko",
        short: "Handgewebter Wandbehang aus Baumwolle, der Wärme und Struktur in jeden Raum bringt.",
        desc: "Handgewebt aus natürlicher Baumwolle an einem Holzstab bringt dieser Wandbehang die Struktur, die einem Raum voller glatter Flächen fehlt. Die neutrale Palette ergänzt jede Wandfarbe, und mit fast einem Meter Höhe verankert er Schlafzimmer, Flur oder Leseecke, ohne zu erdrücken.",
      },
      es: {
        title: "Tapiz de pared tejido",
        short: "Tapiz de algodón tejido a mano que aporta calidez y textura a cualquier habitación.",
        desc: "Tejido a mano en algodón natural sobre una varilla de madera, este tapiz aporta la textura que le falta a una habitación de superficies lisas. Su paleta neutra complementa cualquier color de pared y, con casi un metro de alto, ancla un dormitorio, un pasillo o un rincón de lectura sin recargarlo.",
      },
    },
  },
  "scented-candle-set": {
    brand: null,
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Scented Candle Set",
        short: "Set of three soy-wax candles with layered scents and up to 40 hours of burn time each.",
        desc: "Three moods in one box: a fresh citrus for mornings, warm sandalwood for evenings and clean linen for everything in between. Poured from natural soy wax with cotton wicks, each candle burns evenly for up to 40 hours, and the glass jars find a second life as storage.",
      },
      sr: {
        title: "Set mirisnih sveća",
        short: "Set od tri sveće od sojinog voska sa slojevitim mirisima i do 40 sati gorenja po sveći.",
        desc: "Tri raspoloženja u jednoj kutiji: svež citrus za jutra, topla sandalovina za večeri i čist miris posteljine za sve između. Livene od prirodnog sojinog voska sa pamučnim fitiljima, sveće gore ravnomerno do 40 sati, a staklene tegle dobijaju drugi život kao kutijice za sitnice.",
      },
      de: {
        title: "Duftkerzen-Set",
        short: "Dreier-Set Sojawachskerzen mit vielschichtigen Düften und bis zu 40 Stunden Brenndauer pro Kerze.",
        desc: "Drei Stimmungen in einer Box: frische Zitrus für den Morgen, warmes Sandelholz für den Abend und saubere Leinennote für alles dazwischen. Aus natürlichem Sojawachs mit Baumwolldochten gegossen, brennt jede Kerze gleichmäßig bis zu 40 Stunden - und die Gläser leben als Aufbewahrung weiter.",
      },
      es: {
        title: "Set de velas aromáticas",
        short: "Set de tres velas de cera de soja con aromas por capas y hasta 40 horas de duración cada una.",
        desc: "Tres estados de ánimo en una caja: cítrico fresco para las mañanas, sándalo cálido para las noches y ropa limpia para todo lo demás. Vertidas en cera de soja natural con mechas de algodón, cada vela arde de forma uniforme hasta 40 horas, y los tarros de cristal tienen una segunda vida como almacenaje.",
      },
    },
  },
  "area-rug-160x230": {
    brand: "ikea",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Area Rug 160x230",
        short: "Soft low-pile rug that defines a living space - durable, stain-resistant and easy to vacuum.",
        desc: "A rug pulls a room together, and this 160x230 cm low-pile weave does it without fuss: soft enough for bare feet, flat enough for robot vacuums and door clearances, and treated to resist stains from the inevitable spill. The anti-slip backing keeps it planted on hard floors.",
      },
      sr: {
        title: "Tepih 160x230",
        short: "Mekan tepih niskog florа koji definiše dnevni prostor - izdržljiv, otporan na fleke i lak za usisavanje.",
        desc: "Tepih poveže prostoriju, a ovaj tkani komad 160x230 cm niskog flora to radi bez komplikacija: dovoljno mekan za bose noge, dovoljno nizak za robot usisivače i vrata, i tretiran da odbija fleke od neizbežnog prosipanja. Protivklizna podloga drži ga na mestu na tvrdim podovima.",
      },
      de: {
        title: "Teppich 160x230",
        short: "Weicher Kurzflor-Teppich, der den Wohnbereich definiert - strapazierfähig, fleckabweisend und saugerfreundlich.",
        desc: "Ein Teppich bringt einen Raum zusammen, und dieses 160x230-cm-Kurzflor-Gewebe tut es ohne Aufhebens: weich genug für nackte Füße, flach genug für Saugroboter und Türen und behandelt, um Flecken vom unvermeidlichen Malheur abzuweisen. Die Antirutsch-Unterseite hält ihn auf harten Böden an Ort und Stelle.",
      },
      es: {
        title: "Alfombra 160x230",
        short: "Alfombra suave de pelo corto que define el salón - resistente, antimanchas y fácil de aspirar.",
        desc: "Una alfombra cohesiona la habitación, y este tejido de pelo corto de 160x230 cm lo hace sin complicaciones: suave para los pies descalzos, plano para robots aspiradores y puertas, y tratado para resistir las manchas del derrame inevitable. Su base antideslizante la mantiene fija sobre suelos duros.",
      },
    },
  },
  "cordless-drill-18v": {
    brand: "bosch",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Cordless Drill 18V",
        short: "18V cordless drill driver with two batteries, 20 torque settings and an LED work light.",
        desc: "From flat-pack marathons to deck screws, the 18V cordless drill drives with authority: 20 torque settings prevent stripped heads, the two-speed gearbox covers delicate and demanding jobs, and the second battery charges while you work so you never stall mid-project. LED light included for cabinet corners.",
      },
      sr: {
        title: "Akumulatorska bušilica 18V",
        short: "Akumulatorska bušilica-odvijač 18V sa dve baterije, 20 podešavanja momenta i LED svetlom.",
        desc: "Od maratona sklapanja nameštaja do šrafova za terasu, akumulatorska bušilica od 18V radi autoritativno: 20 podešavanja obrtnog momenta sprečava oštećene glave šrafova, dvobrzinski menjač pokriva nežne i zahtevne poslove, a druga baterija se puni dok radite pa projekat nikada ne staje. LED svetlo za uglove ormara uključeno.",
      },
      de: {
        title: "Akkubohrschrauber 18V",
        short: "18V-Akkubohrschrauber mit zwei Akkus, 20 Drehmomentstufen und LED-Arbeitslicht.",
        desc: "Vom Möbelaufbau-Marathon bis zur Terrassenschraube: Der 18V-Akkubohrschrauber treibt mit Nachdruck. 20 Drehmomentstufen verhindern vermurkste Schraubenköpfe, das Zweigang-Getriebe deckt feine wie fordernde Arbeiten ab, und der zweite Akku lädt, während Sie arbeiten - kein Stillstand mitten im Projekt. LED-Licht für dunkle Schrankecken inklusive.",
      },
      es: {
        title: "Taladro inalámbrico 18V",
        short: "Taladro atornillador inalámbrico de 18V con dos baterías, 20 ajustes de par y luz LED.",
        desc: "De los maratones de muebles en kit a los tornillos de la terraza, el taladro inalámbrico de 18V trabaja con autoridad: 20 ajustes de par evitan cabezas pasadas, el cambio de dos velocidades cubre trabajos delicados y exigentes, y la segunda batería se carga mientras trabajas para que el proyecto nunca se pare. Luz LED incluida para rincones de armario.",
      },
    },
  },
  "socket-wrench-set": {
    brand: "bosch",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Socket Wrench Set",
        short: "72-piece chrome-vanadium socket set with quick-release ratchets in a fitted case.",
        desc: "The set that ends the search for the right size: 72 chrome-vanadium pieces covering metric sockets from 4 to 32 mm, two quick-release ratchets, extensions and adapters, each with its own labeled slot in the fitted case. Torque-tested for workshop use and guaranteed for life.",
      },
      sr: {
        title: "Set nasadnih ključeva",
        short: "Set nasadnih ključeva od 72 dela od hrom-vanadijuma sa brzootpuštajućim čegrtaljkama u koferu.",
        desc: "Set koji okončava potragu za pravom merom: 72 dela od hrom-vanadijuma pokrivaju metričke nasadne ključeve od 4 do 32 mm, dve čegrtaljke sa brzim otpuštanjem, produžeci i adapteri, svaki sa svojim obeleženim mestom u koferu. Testiran na moment za radioničku upotrebu i sa doživotnom garancijom.",
      },
      de: {
        title: "Steckschlüsselsatz",
        short: "72-teiliger Chrom-Vanadium-Steckschlüsselsatz mit Schnellwechsel-Knarren im Formkoffer.",
        desc: "Der Satz, der die Suche nach der richtigen Größe beendet: 72 Chrom-Vanadium-Teile mit metrischen Nüssen von 4 bis 32 mm, zwei Knarren mit Schnellwechsel, Verlängerungen und Adaptern - jedes Teil mit beschriftetem Platz im Formkoffer. Drehmomentgeprüft für den Werkstatteinsatz, mit lebenslanger Garantie.",
      },
      es: {
        title: "Juego de llaves de vaso",
        short: "Juego de 72 piezas de cromo-vanadio con carracas de liberación rápida en maletín a medida.",
        desc: "El juego que acaba con la búsqueda de la medida correcta: 72 piezas de cromo-vanadio con vasos métricos de 4 a 32 mm, dos carracas de liberación rápida, extensiones y adaptadores, cada uno con su hueco etiquetado en el maletín. Probado a par para uso de taller y garantizado de por vida.",
      },
    },
  },
  "adjustable-dumbbells": {
    brand: null,
    variants: { mode: "none" },
    t: {
      en: {
        title: "Adjustable Dumbbells",
        short: "Space-saving adjustable dumbbells that replace an entire rack - 2.5 to 24 kg per hand.",
        desc: "One pair, a whole gym: twist the dial and each dumbbell shifts from 2.5 to 24 kg in seconds, replacing fifteen pairs of fixed weights and the rack they would need. The knurled grip stays secure through sweaty sets, and the molded trays keep your floor and your toes safe.",
      },
      sr: {
        title: "Podesive bučice",
        short: "Podesive bučice koje štede prostor i menjaju ceo stalak tegova - 2,5 do 24 kg po ruci.",
        desc: "Jedan par, cela teretana: okrenite točkić i svaka bučica menja težinu od 2,5 do 24 kg za par sekundi, menjajući petnaest pari fiksnih tegova i stalak koji bi im trebao. Nareckani rukohvat ostaje siguran i tokom znojavih serija, a kalupljena postolja čuvaju i pod i prste na nogama.",
      },
      de: {
        title: "Verstellbare Kurzhanteln",
        short: "Platzsparende verstellbare Kurzhanteln, die ein ganzes Rack ersetzen - 2,5 bis 24 kg pro Hand.",
        desc: "Ein Paar, ein ganzes Studio: Am Drehrad wechselt jede Hantel in Sekunden von 2,5 auf bis zu 24 kg und ersetzt damit fünfzehn Paar feste Gewichte samt Rack. Der gerändelte Griff bleibt auch bei schweißtreibenden Sätzen sicher, und die geformten Ablagen schützen Boden und Zehen.",
      },
      es: {
        title: "Mancuernas ajustables",
        short: "Mancuernas ajustables que ahorran espacio y sustituyen un rack entero - de 2,5 a 24 kg por mano.",
        desc: "Un par, un gimnasio completo: gira el dial y cada mancuerna pasa de 2,5 a 24 kg en segundos, sustituyendo quince pares de pesas fijas y el rack que necesitarían. El agarre moleteado se mantiene firme en las series más sudorosas, y las bandejas moldeadas protegen tu suelo y tus pies.",
      },
    },
  },
  "yoga-mat-pro": {
    brand: "nike",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Yoga Mat Pro",
        short: "Extra-thick non-slip yoga mat with alignment lines and a carry strap.",
        desc: "The Yoga Mat Pro grips when you need it most: the textured natural-rubber surface stays put through sweaty vinyasas, 6 mm of cushioning protects knees and wrists, and subtle alignment lines guide your hands and feet into place. Comes with a carry strap for the walk to class.",
      },
      sr: {
        title: "Prostirka za jogu Pro",
        short: "Ekstra debela protivklizna prostirka za jogu sa linijama za poravnanje i kaišem za nošenje.",
        desc: "Prostirka za jogu Pro prianja kada vam najviše treba: teksturirana površina od prirodne gume ne mrda ni tokom znojavih vinjasa, 6 mm amortizacije štiti kolena i zglobove, a suptilne linije za poravnanje vode šake i stopala na pravo mesto. Stiže sa kaišem za nošenje do časa.",
      },
      de: {
        title: "Yogamatte Pro",
        short: "Extradicke rutschfeste Yogamatte mit Ausrichtungslinien und Tragegurt.",
        desc: "Die Yogamatte Pro hält, wenn es darauf ankommt: Die strukturierte Naturkautschuk-Oberfläche bleibt auch bei schweißtreibenden Vinyasas an Ort und Stelle, 6 mm Polsterung schützen Knie und Handgelenke, und dezente Ausrichtungslinien führen Hände und Füße in Position. Mit Tragegurt für den Weg zum Kurs.",
      },
      es: {
        title: "Esterilla de yoga Pro",
        short: "Esterilla de yoga extragruesa y antideslizante con líneas de alineación y correa de transporte.",
        desc: "La esterilla de yoga Pro agarra cuando más lo necesitas: su superficie texturizada de caucho natural no se mueve ni en los vinyasas más sudorosos, sus 6 mm de acolchado protegen rodillas y muñecas, y unas sutiles líneas de alineación guían manos y pies a su sitio. Incluye correa para llevarla a clase.",
      },
    },
  },
  "resistance-band-set": {
    brand: "adidas",
    variants: { mode: "none" },
    t: {
      en: {
        title: "Resistance Band Set",
        short: "Five color-coded resistance bands with handles, anchor and ankle straps - a gym in a pouch.",
        desc: "Strength training that fits in a drawer: five color-coded bands stack from feather-light to seriously heavy, and the included handles, door anchor and ankle straps unlock hundreds of exercises. Ideal for home workouts, travel and physio-guided rehabilitation.",
      },
      sr: {
        title: "Set elastičnih traka",
        short: "Pet elastičnih traka označenih bojama sa ručkama, sidrom za vrata i manžetnama - teretana u torbici.",
        desc: "Trening snage koji staje u fioku: pet traka označenih bojama slaže se od perolakih do ozbiljno teških, a priložene ručke, sidro za vrata i manžetne za članke otključavaju stotine vežbi. Idealno za trening kod kuće, putovanja i rehabilitaciju uz fizioterapeuta.",
      },
      de: {
        title: "Widerstandsbänder-Set",
        short: "Fünf farbcodierte Widerstandsbänder mit Griffen, Türanker und Fußschlaufen - ein Studio im Beutel.",
        desc: "Krafttraining, das in eine Schublade passt: Fünf farbcodierte Bänder stapeln sich von federleicht bis richtig schwer, und die mitgelieferten Griffe, der Türanker und die Fußschlaufen schalten Hunderte Übungen frei. Ideal für Heimtraining, Reisen und physiogeführte Reha.",
      },
      es: {
        title: "Set de bandas de resistencia",
        short: "Cinco bandas de resistencia con código de color, asas, anclaje de puerta y tobilleras - un gimnasio en una bolsa.",
        desc: "Entrenamiento de fuerza que cabe en un cajón: cinco bandas con código de color van de ligerísimas a realmente duras, y las asas, el anclaje de puerta y las tobilleras incluidas desbloquean cientos de ejercicios. Ideal para entrenar en casa, viajar y rehabilitación guiada por fisioterapeuta.",
      },
    },
  },
  "foam-roller": {
    brand: "nike",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Foam Roller",
        short: "High-density foam roller with a textured surface for deep-tissue muscle recovery.",
        desc: "Your recovery day essential: the high-density core keeps its shape under full body weight, while the textured surface reaches deeper into tight calves, quads and backs than smooth rollers can. Ten minutes after a run today saves a stiff tomorrow.",
      },
      sr: {
        title: "Foam roler",
        short: "Roler od pene visoke gustine sa teksturiranom površinom za duboku regeneraciju mišića.",
        desc: "Osnovno oruđe za dan oporavka: jezgro visoke gustine drži formu pod punom težinom tela, dok teksturirana površina dopire dublje u zategnute listove, butine i leđa nego glatki roleri. Deset minuta posle današnjeg trčanja štedi ukočeno sutra.",
      },
      de: {
        title: "Faszienrolle",
        short: "Faszienrolle mit hoher Dichte und strukturierter Oberfläche für tiefe Muskelregeneration.",
        desc: "Das Essential für den Regenerationstag: Der Kern mit hoher Dichte behält unter vollem Körpergewicht seine Form, während die strukturierte Oberfläche tiefer in verspannte Waden, Oberschenkel und Rücken vordringt als glatte Rollen. Zehn Minuten nach dem heutigen Lauf ersparen das steife Morgen.",
      },
      es: {
        title: "Rodillo de espuma",
        short: "Rodillo de espuma de alta densidad con superficie texturizada para una recuperación muscular profunda.",
        desc: "El imprescindible de tu día de descanso: el núcleo de alta densidad mantiene su forma bajo todo el peso del cuerpo, mientras la superficie texturizada llega más adentro en gemelos, cuádriceps y espalda cargados que los rodillos lisos. Diez minutos tras la carrera de hoy ahorran la rigidez de mañana.",
      },
    },
  },
  "2-person-tent": {
    brand: null,
    variants: { mode: "keep" },
    t: {
      en: {
        title: "2-Person Tent",
        short: "Lightweight two-person tent that pitches in five minutes and stands up to real weather.",
        desc: "Weekend escapes made simple: the color-coded poles pitch this two-person tent in five minutes even in fading light, the 3000 mm rainfly shrugs off overnight storms, and mesh panels keep air moving on warm nights. Packs down small enough for a bike pannier.",
      },
      sr: {
        title: "Šator za 2 osobe",
        short: "Lagan šator za dve osobe koji se postavlja za pet minuta i podnosi pravo nevreme.",
        desc: "Vikend bekstva bez komplikacija: šipke označene bojama postavljaju ovaj šator za dvoje za pet minuta čak i u sumrak, cerada od 3000 mm odbija noćne oluje, a mrežasti paneli održavaju cirkulaciju vazduha u toplim noćima. Pakuje se dovoljno malo za biciklističku torbu.",
      },
      de: {
        title: "2-Personen-Zelt",
        short: "Leichtes Zwei-Personen-Zelt, das in fünf Minuten steht und echtem Wetter trotzt.",
        desc: "Wochenendausflüge leicht gemacht: Dank farbcodierter Gestängebögen steht dieses Zwei-Personen-Zelt in fünf Minuten, selbst in der Dämmerung. Das 3000-mm-Außenzelt trotzt nächtlichen Stürmen, Mesh-Einsätze halten die Luft in warmen Nächten in Bewegung. Klein verpackbar - passt in eine Fahrradtasche.",
      },
      es: {
        title: "Tienda para 2 personas",
        short: "Tienda ligera para dos personas que se monta en cinco minutos y aguanta el mal tiempo de verdad.",
        desc: "Escapadas de fin de semana sin complicaciones: las varillas con código de color montan esta tienda para dos en cinco minutos incluso con poca luz, el doble techo de 3000 mm resiste tormentas nocturnas y los paneles de malla mantienen el aire en movimiento en noches cálidas. Se pliega tan pequeña que cabe en una alforja.",
      },
    },
  },
  "insulated-water-bottle": {
    brand: "adidas",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Insulated Water Bottle",
        short: "Double-wall steel bottle that keeps drinks cold for 24 hours or hot for 12.",
        desc: "Ice cubes still rattling at day's end: double-wall vacuum insulation keeps drinks cold for 24 hours or hot for 12, the powder-coated steel shrugs off drops and scratches, and the leakproof lid survives being thrown in a bag upside down. One bottle, zero single-use plastic.",
      },
      sr: {
        title: "Termo flaša",
        short: "Čelična flaša sa duplim zidom koja drži piće hladnim 24 sata ili toplim 12.",
        desc: "Kockice leda zveckaju i na kraju dana: vakuumska izolacija sa duplim zidom drži piće hladnim 24 sata ili toplim 12, čelik sa završnicom u prahu podnosi padove i ogrebotine, a poklopac koji ne curi preživljava i naglavačke bačen u torbu. Jedna flaša, nula jednokratne plastike.",
      },
      de: {
        title: "Isolierte Trinkflasche",
        short: "Doppelwandige Stahlflasche, die Getränke 24 Stunden kalt oder 12 Stunden heiß hält.",
        desc: "Eiswürfel, die am Abend noch klirren: Die doppelwandige Vakuumisolierung hält Getränke 24 Stunden kalt oder 12 Stunden heiß, der pulverbeschichtete Stahl steckt Stürze und Kratzer weg, und der auslaufsichere Deckel übersteht auch die kopfüber gepackte Tasche. Eine Flasche, null Einwegplastik.",
      },
      es: {
        title: "Botella térmica",
        short: "Botella de acero de doble pared que mantiene la bebida fría 24 horas o caliente 12.",
        desc: "Cubitos que aún suenan al final del día: el aislamiento al vacío de doble pared mantiene las bebidas frías 24 horas o calientes 12, el acero con recubrimiento en polvo aguanta caídas y arañazos, y la tapa antigoteo sobrevive a la mochila boca abajo. Una botella, cero plástico de un solo uso.",
      },
    },
  },
  "hiking-backpack-40l": {
    brand: "adidas",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Hiking Backpack 40L",
        short: "40-liter trekking backpack with a ventilated back system and rain cover included.",
        desc: "Big enough for a hut-to-hut week, comfortable enough for a day hike: the 40-liter pack transfers weight to your hips through a padded belt, the suspended mesh back keeps sweat off your shirt, and dedicated pockets organize water, snacks and layers. Rain cover stows in its own pocket.",
      },
      sr: {
        title: "Planinarski ranac 40L",
        short: "Treking ranac od 40 litara sa ventiliranim leđnim sistemom i kabanicom u kompletu.",
        desc: "Dovoljno velik za nedelju od koliba do kolibe, dovoljno udoban za jednodnevni izlet: ranac od 40 litara prenosi težinu na kukove kroz postavljeni pojas, odignuta mrežasta leđa sklanjaju znoj sa majice, a namenski džepovi organizuju vodu, užinu i slojeve. Kabanica za ranac ima svoj džep.",
      },
      de: {
        title: "Wanderrucksack 40L",
        short: "40-Liter-Trekkingrucksack mit belüftetem Rückensystem und inkludierter Regenhülle.",
        desc: "Groß genug für eine Hüttenwoche, bequem genug für die Tagestour: Der 40-Liter-Rucksack überträgt das Gewicht über den gepolsterten Hüftgurt, das abgespannte Mesh-Rückenteil hält den Schweiß vom Shirt fern, und eigene Taschen organisieren Wasser, Snacks und Schichten. Die Regenhülle verstaut sich in ihrer eigenen Tasche.",
      },
      es: {
        title: "Mochila de senderismo 40L",
        short: "Mochila de trekking de 40 litros con espalda ventilada y funda de lluvia incluida.",
        desc: "Grande para una semana de refugio en refugio y cómoda para una excursión de un día: la mochila de 40 litros transfiere el peso a las caderas mediante un cinturón acolchado, la espalda de malla suspendida aleja el sudor de la camiseta y sus bolsillos específicos organizan agua, comida y capas. La funda de lluvia se guarda en su propio bolsillo.",
      },
    },
  },
  "mountain-bike-29": {
    brand: null,
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Mountain Bike 29",
        short: "29-inch hardtail mountain bike with a lockout fork and 1x11 drivetrain.",
        desc: "Big wheels roll over what smaller ones bounce off: the 29-inch hardtail pairs a 100 mm suspension fork with remote lockout for efficient climbs, a simple 1x11 drivetrain with all the range you need, and hydraulic disc brakes that bite reliably in rain and mud. Trail-ready out of the box.",
      },
      sr: {
        title: "Brdski bicikl 29",
        short: "Hardtail brdski bicikl od 29 inča sa blokadom viljuške i 1x11 pogonom.",
        desc: "Veliki točkovi prelaze preko onoga od čega se manji odbijaju: hardtail od 29 inča spaja viljušku od 100 mm sa daljinskom blokadom za efikasne uspone, jednostavan 1x11 pogon sa svim potrebnim rasponom i hidraulične disk kočnice koje pouzdano grizu i po kiši i blatu. Spreman za stazu odmah iz kutije.",
      },
      de: {
        title: "Mountainbike 29",
        short: "29-Zoll-Hardtail-Mountainbike mit Lockout-Gabel und 1x11-Antrieb.",
        desc: "Große Räder rollen über das, woran kleinere abprallen: Das 29-Zoll-Hardtail kombiniert eine 100-mm-Federgabel mit Remote-Lockout für effiziente Anstiege, einen simplen 1x11-Antrieb mit aller nötigen Bandbreite und hydraulische Scheibenbremsen, die auch bei Regen und Schlamm zuverlässig zupacken. Trail-bereit ab Werk.",
      },
      es: {
        title: "Bicicleta de montaña 29",
        short: "Bicicleta de montaña rígida de 29 pulgadas con horquilla bloqueable y transmisión 1x11.",
        desc: "Las ruedas grandes ruedan sobre lo que hace rebotar a las pequeñas: esta rígida de 29 pulgadas combina una horquilla de 100 mm con bloqueo remoto para subir con eficiencia, una transmisión sencilla 1x11 con todo el rango necesario y frenos de disco hidráulicos que muerden con lluvia y barro. Lista para el sendero desde la caja.",
      },
    },
  },
  "cycling-helmet": {
    brand: null,
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Cycling Helmet",
        short: "Ventilated cycling helmet with MIPS-style rotational protection and a magnetic buckle.",
        desc: "Protection you forget you are wearing: 22 vents move air across your head on climbs, the rotational-impact liner adds protection where standard helmets stop, and the dial fit system micro-adjusts with one hand. The magnetic buckle clicks shut even with gloves on.",
      },
      sr: {
        title: "Biciklistička kaciga",
        short: "Ventilirana biciklistička kaciga sa zaštitom od rotacionih udara i magnetnom kopčom.",
        desc: "Zaštita koju zaboravite da nosite: 22 ventilaciona otvora provode vazduh preko glave na usponima, obloga protiv rotacionih udara dodaje zaštitu tamo gde standardne kacige staju, a točkić za podešavanje precizno se štimuje jednom rukom. Magnetna kopča škljocne i sa rukavicama.",
      },
      de: {
        title: "Fahrradhelm",
        short: "Belüfteter Fahrradhelm mit Rotationsschutz nach MIPS-Prinzip und Magnetverschluss.",
        desc: "Schutz, den man beim Tragen vergisst: 22 Belüftungsöffnungen führen am Anstieg Luft über den Kopf, das Rotationsschutz-Innenleben schützt dort weiter, wo Standardhelme aufhören, und das Drehrad-System justiert mit einer Hand nach. Der Magnetverschluss klickt sogar mit Handschuhen zu.",
      },
      es: {
        title: "Casco de ciclismo",
        short: "Casco de ciclismo ventilado con protección rotacional tipo MIPS y hebilla magnética.",
        desc: "Una protección que olvidas que llevas: 22 ventilaciones mueven el aire por la cabeza en las subidas, el forro contra impactos rotacionales protege donde los cascos estándar se quedan cortos y el sistema de ajuste por rueda se regula con una mano. La hebilla magnética se cierra con un clic incluso con guantes.",
      },
    },
  },
};
