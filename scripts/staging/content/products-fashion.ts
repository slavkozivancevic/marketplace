import type { ProductContent } from "./types";

// Fashion: men's, women's, kids' clothing, shoes, bags & accessories.

export const fashion: Record<string, ProductContent> = {
  "classic-cotton-t-shirt": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Classic Cotton T-Shirt",
        short: "Everyday tee in soft combed cotton with a regular fit that keeps its shape.",
        desc: "The t-shirt you reach for every morning: soft combed cotton with a smooth hand-feel, a regular fit that flatters without clinging, and reinforced shoulder seams so it keeps its shape wash after wash. A true wardrobe basic worth buying in more than one color.",
      },
      sr: {
        title: "Klasična pamučna majica",
        short: "Svakodnevna majica od mekog češljanog pamuka, standardnog kroja koji drži formu.",
        desc: "Majica za kojom posežete svako jutro: mek češljani pamuk glatkog opipa, standardni kroj koji laska bez pripijanja i ojačani šavovi na ramenima da drži formu pranje za pranjem. Pravi osnovni komad garderobe koji vredi kupiti u više boja.",
      },
      de: {
        title: "Klassisches Baumwoll-T-Shirt",
        short: "Alltags-Shirt aus weicher gekämmter Baumwolle mit formstabiler Regular Fit.",
        desc: "Das T-Shirt, zu dem Sie jeden Morgen greifen: weiche gekämmte Baumwolle mit glattem Griff, eine Regular Fit, die schmeichelt, ohne zu kleben, und verstärkte Schulternähte, damit es Wäsche für Wäsche in Form bleibt. Ein echtes Garderoben-Basic, das man am besten gleich mehrfach kauft.",
      },
      es: {
        title: "Camiseta clásica de algodón",
        short: "Camiseta diaria de suave algodón peinado con corte regular que mantiene la forma.",
        desc: "La camiseta que eliges cada mañana: algodón peinado suave con tacto liso, un corte regular que favorece sin ceñirse y costuras de hombro reforzadas para que mantenga la forma lavado tras lavado. Un básico de armario que merece la pena tener en varios colores.",
      },
    },
  },
  "oxford-shirt": {
    brand: "levis",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Oxford Shirt",
        short: "Button-down Oxford shirt that dresses up with chinos or down with jeans.",
        desc: "The Oxford shirt has earned its place in every wardrobe: the basket-weave cotton is sturdy yet breathable, the button-down collar keeps its line with or without a jacket, and the cut works tucked into chinos on Monday and loose over jeans on Saturday. Softens beautifully with every wash.",
      },
      sr: {
        title: "Oxford košulja",
        short: "Oxford košulja sa kragnom na dugmad - elegantna uz čino pantalone, ležerna uz farmerke.",
        desc: "Oxford košulja zaslužila je mesto u svakom garderoberu: pamuk korpastog tkanja čvrst je a prozračan, kragna na dugmad drži liniju sa sakoom ili bez njega, a kroj radi i upasan u čino pantalone ponedeljkom i preko farmerki subotom. Sa svakim pranjem postaje sve mekša.",
      },
      de: {
        title: "Oxford-Hemd",
        short: "Button-Down-Oxfordhemd - elegant zur Chino, lässig zur Jeans.",
        desc: "Das Oxford-Hemd hat sich seinen Platz in jedem Kleiderschrank verdient: Die Baumwolle in Korbbindung ist robust und doch atmungsaktiv, der Button-Down-Kragen hält seine Linie mit und ohne Sakko, und der Schnitt funktioniert montags in der Chino und samstags offen über der Jeans. Wird mit jeder Wäsche schöner weich.",
      },
      es: {
        title: "Camisa Oxford",
        short: "Camisa Oxford con cuello abotonado - elegante con chinos, informal con vaqueros.",
        desc: "La camisa Oxford se ha ganado su sitio en cualquier armario: su algodón de tejido panal es resistente pero transpirable, el cuello abotonado mantiene la línea con o sin americana, y el corte funciona por dentro con chinos el lunes y por fuera con vaqueros el sábado. Se suaviza con cada lavado.",
      },
    },
  },
  "slim-fit-jeans": {
    brand: "levis",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Slim Fit Jeans",
        short: "Modern slim jeans with just enough stretch to stay comfortable all day.",
        desc: "Slim through the leg without squeezing, these jeans blend classic denim with two percent stretch so they move when you do. The mid-rise waist sits naturally, the indigo wash pairs with everything, and reinforced stitching at stress points means they are built for years, not seasons.",
      },
      sr: {
        title: "Farmerke slim kroja",
        short: "Moderne uske farmerke sa taman dovoljno elastina da budu udobne ceo dan.",
        desc: "Uske niz nogu ali bez stezanja, ove farmerke spajaju klasičan teksas sa dva procenta elastina, pa se pomeraju zajedno sa vama. Srednje visok struk prirodno naleže, indigo pranje ide uz sve, a ojačani šavovi na kritičnim tačkama znače da su pravljene za godine, ne za sezone.",
      },
      de: {
        title: "Slim-Fit-Jeans",
        short: "Moderne Slim-Jeans mit genau so viel Stretch, dass sie den ganzen Tag bequem bleibt.",
        desc: "Schmal am Bein, ohne einzuengen: Diese Jeans verbindet klassischen Denim mit zwei Prozent Stretch und macht jede Bewegung mit. Der mittelhohe Bund sitzt natürlich, die Indigo-Waschung passt zu allem, und verstärkte Nähte an den Belastungspunkten machen sie zur Anschaffung für Jahre statt Saisons.",
      },
      es: {
        title: "Vaqueros slim fit",
        short: "Vaqueros slim modernos con la elasticidad justa para estar cómodo todo el día.",
        desc: "Ajustados en la pierna sin apretar, estos vaqueros combinan el denim clásico con un dos por ciento de elastano para moverse contigo. El tiro medio asienta de forma natural, el lavado índigo combina con todo y las costuras reforzadas en los puntos de tensión los hacen durar años, no temporadas.",
      },
    },
  },
  "hooded-sweatshirt": {
    brand: "hm",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Hooded Sweatshirt",
        short: "Mid-weight fleece hoodie with a double-lined hood and roomy kangaroo pocket.",
        desc: "The hoodie that does it all: brushed fleece inside for warmth, a double-lined hood that actually stays up, and a kangaroo pocket sized for cold hands and a phone. Ribbed cuffs and hem keep the shape, and the mid-weight fabric layers as easily under a jacket as over a tee.",
      },
      sr: {
        title: "Duks sa kapuljačom",
        short: "Duks od flisa srednje težine sa duplo postavljenom kapuljačom i prostranim džepom.",
        desc: "Duks koji radi sve: iznutra češljani flis za toplotu, duplo postavljena kapuljača koja zaista stoji podignuta i kengur džep dovoljan za hladne ruke i telefon. Rebraste manžetne i porub čuvaju formu, a tkanina srednje težine ide podjednako lako ispod jakne i preko majice.",
      },
      de: {
        title: "Kapuzenpullover",
        short: "Mittelschwerer Fleece-Hoodie mit doppelt gefütterter Kapuze und großer Kängurutasche.",
        desc: "Der Hoodie für alles: innen angerauter Fleece für Wärme, eine doppelt gefütterte Kapuze, die wirklich oben bleibt, und eine Kängurutasche mit Platz für kalte Hände und ein Handy. Rippbündchen an Ärmeln und Saum halten die Form, und der mittelschwere Stoff funktioniert unter der Jacke genauso gut wie über dem T-Shirt.",
      },
      es: {
        title: "Sudadera con capucha",
        short: "Sudadera de felpa de peso medio con capucha de doble forro y amplio bolsillo canguro.",
        desc: "La sudadera que lo hace todo: felpa cepillada por dentro para abrigar, una capucha de doble forro que de verdad se mantiene puesta y un bolsillo canguro con sitio para las manos frías y el móvil. Los puños y el bajo de canalé conservan la forma, y el tejido de peso medio va igual de bien bajo una chaqueta que sobre una camiseta.",
      },
    },
  },
  "wool-blazer": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Wool Blazer",
        short: "Tailored wool-blend blazer with a half-canvas construction that drapes naturally.",
        desc: "A blazer that looks tailored without the tailor: the wool blend drapes naturally, the half-canvas front molds to your chest over time, and the notch lapel hits the sweet spot between business and evening. Interior pockets hold phone, cards and travel documents securely.",
      },
      sr: {
        title: "Vuneni sako",
        short: "Elegantan sako od mešavine vune, polukanvas izrade, koji prirodno pada.",
        desc: "Sako koji izgleda krojen po meri bez odlaska krojaču: mešavina vune prirodno pada, polukanvas prednjica se vremenom oblikuje prema telu, a klasičan rever pogađa tačku između poslovnog i večernjeg. Unutrašnji džepovi sigurno čuvaju telefon, kartice i dokumenta za put.",
      },
      de: {
        title: "Wollblazer",
        short: "Taillierter Blazer aus Wollmischung mit Halbrosshaar-Einlage und natürlichem Fall.",
        desc: "Ein Blazer, der maßgeschneidert aussieht, ohne es zu sein: Die Wollmischung fällt natürlich, die Halbrosshaar-Front passt sich mit der Zeit der Brust an, und das steigende Revers trifft genau die Mitte zwischen Business und Abend. Innentaschen sichern Handy, Karten und Reisedokumente.",
      },
      es: {
        title: "Americana de lana",
        short: "Americana entallada de mezcla de lana con construcción semientretelada de caída natural.",
        desc: "Una americana con aspecto de sastrería sin pasar por el sastre: la mezcla de lana cae con naturalidad, el delantero semientretelado se amolda al pecho con el tiempo y la solapa de muesca acierta entre lo formal y lo nocturno. Los bolsillos interiores guardan con seguridad móvil, tarjetas y documentación.",
      },
    },
  },
  "chino-trousers": {
    brand: "hm",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Chino Trousers",
        short: "Smart-casual cotton chinos with a tapered leg and a hint of stretch.",
        desc: "The trousers that bridge office and weekend: brushed cotton twill with a touch of stretch, a tapered leg that looks sharp with sneakers or loafers, and a clean waistband that holds a tucked shirt neatly. Machine washable and resistant to wrinkles straight off the drying rack.",
      },
      sr: {
        title: "Čino pantalone",
        short: "Pamučne čino pantalone za posao i vikend, suženog kroja sa malo elastina.",
        desc: "Pantalone koje spajaju kancelariju i vikend: četkani pamučni keper sa malo elastina, sužena nogavica koja izgleda uredno uz patike i mokasine i čist pojas koji lepo drži upasanu košulju. Peru se u mašini i ne gužvaju se čim se osuše.",
      },
      de: {
        title: "Chino-Hose",
        short: "Smart-casual Baumwoll-Chino mit verjüngtem Bein und etwas Stretch.",
        desc: "Die Hose zwischen Büro und Wochenende: gebürsteter Baumwoll-Twill mit einem Hauch Stretch, ein verjüngtes Bein, das zu Sneakern wie Loafern schick aussieht, und ein sauberer Bund, der das Hemd ordentlich hält. Maschinenwaschbar und direkt vom Wäscheständer knitterarm.",
      },
      es: {
        title: "Pantalones chinos",
        short: "Chinos de algodón smart-casual con pierna afinada y un punto de elasticidad.",
        desc: "El pantalón que une oficina y fin de semana: sarga de algodón cepillada con un punto de elastano, pierna afinada que queda impecable con zapatillas o mocasines y una cinturilla limpia que sujeta bien la camisa por dentro. Lavable a máquina y resistente a las arrugas nada más secarse.",
      },
    },
  },
  "summer-dress": {
    brand: "hm",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Summer Dress",
        short: "Breezy midi dress in lightweight viscose with a flattering wrap silhouette.",
        desc: "Warm days call for the Summer Dress: lightweight viscose that moves with the breeze, a wrap silhouette that flatters every figure, and discreet side pockets - because dresses deserve pockets too. Dress it up with sandals for dinner or down with sneakers for the market.",
      },
      sr: {
        title: "Letnja haljina",
        short: "Prozračna midi haljina od lagane viskoze sa laskavom siluetom na preklop.",
        desc: "Topli dani traže Letnju haljinu: lagana viskoza koja se pomera sa povetarcem, silueta na preklop koja laska svakoj figuri i diskretni bočni džepovi - jer i haljine zaslužuju džepove. Uz sandale za večeru ili uz patike za pijacu.",
      },
      de: {
        title: "Sommerkleid",
        short: "Luftiges Midikleid aus leichter Viskose mit schmeichelnder Wickelsilhouette.",
        desc: "Warme Tage verlangen nach dem Sommerkleid: leichte Viskose, die sich mit der Brise bewegt, eine Wickelsilhouette, die jeder Figur schmeichelt, und diskrete Seitentaschen - denn auch Kleider verdienen Taschen. Mit Sandalen fürs Abendessen, mit Sneakern für den Markt.",
      },
      es: {
        title: "Vestido de verano",
        short: "Vestido midi vaporoso de viscosa ligera con favorecedora silueta cruzada.",
        desc: "Los días cálidos piden el vestido de verano: viscosa ligera que se mueve con la brisa, una silueta cruzada que favorece a cualquier figura y discretos bolsillos laterales - porque los vestidos también merecen bolsillos. Con sandalias para cenar o con zapatillas para el mercado.",
      },
    },
  },
  "knit-sweater": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Knit Sweater",
        short: "Soft mid-gauge knit sweater with a relaxed fit and ribbed trims.",
        desc: "The Knit Sweater is the answer to every chilly morning: a soft mid-gauge knit that is warm without bulk, a relaxed fit that layers over shirts, and ribbed trims at neck, cuffs and hem that keep the silhouette tidy. Holds its softness and shape through gentle machine washes.",
      },
      sr: {
        title: "Pleteni džemper",
        short: "Mekan pleteni džemper srednje debljine, opuštenog kroja sa rebrastim ivicama.",
        desc: "Pleteni džemper je odgovor na svako prohladno jutro: meka pletenina srednje debljine koja greje bez glomaznosti, opušten kroj koji se slaže preko košulja i rebraste ivice na okovratniku, manžetnama i porubu koje drže urednu siluetu. Zadržava mekoću i formu i posle blagog mašinskog pranja.",
      },
      de: {
        title: "Strickpullover",
        short: "Weicher Strickpullover mittlerer Stärke mit lässiger Passform und Rippbündchen.",
        desc: "Der Strickpullover ist die Antwort auf jeden kühlen Morgen: weicher Strick mittlerer Stärke, der wärmt, ohne aufzutragen, eine lässige Passform, die sich über Hemden schichten lässt, und Rippbündchen an Kragen, Ärmeln und Saum für eine saubere Silhouette. Bleibt auch nach schonender Maschinenwäsche weich und in Form.",
      },
      es: {
        title: "Jersey de punto",
        short: "Suave jersey de punto de grosor medio con corte relajado y remates de canalé.",
        desc: "El jersey de punto es la respuesta a cada mañana fresca: un punto suave de grosor medio que abriga sin abultar, un corte relajado que se lleva sobre camisas y remates de canalé en cuello, puños y bajo que mantienen la silueta ordenada. Conserva su suavidad y forma con lavados suaves a máquina.",
      },
    },
  },
  "high-waist-jeans": {
    brand: "levis",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "High-Waist Jeans",
        short: "High-rise jeans that hold their shape with a leg-lengthening straight cut.",
        desc: "The high rise sits at your natural waist and stays there - no tugging, no gaps at the back. Firm yet flexible denim smooths and supports, while the straight leg lengthens the silhouette from waist to hem. A timeless wash makes these the jeans that go with everything you own.",
      },
      sr: {
        title: "Farmerke visokog struka",
        short: "Farmerke visokog struka koje drže formu, sa pravim krojem koji izdužuje nogu.",
        desc: "Visoki struk seda na prirodnu liniju i tu ostaje - bez povlačenja i bez zjapljenja pozadi. Čvrst a savitljiv teksas zaglađuje i pridržava, dok prava nogavica izdužuje siluetu od struka do poruba. Bezvremensko pranje čini ih farmerkama koje idu uz sve što imate.",
      },
      de: {
        title: "High-Waist-Jeans",
        short: "Formstabile Jeans mit hohem Bund und beinstreckendem geradem Schnitt.",
        desc: "Der hohe Bund sitzt auf der natürlichen Taille und bleibt dort - kein Zuppeln, keine Lücke am Rücken. Fester und doch flexibler Denim glättet und stützt, während das gerade Bein die Silhouette von der Taille bis zum Saum streckt. Die zeitlose Waschung macht sie zur Jeans, die zu allem passt.",
      },
      es: {
        title: "Vaqueros de tiro alto",
        short: "Vaqueros de tiro alto que mantienen la forma, con corte recto que alarga la pierna.",
        desc: "El tiro alto asienta en la cintura natural y se queda ahí - sin tirones ni huecos en la espalda. Un denim firme pero flexible alisa y sujeta, mientras la pierna recta alarga la silueta de la cintura al bajo. Su lavado atemporal los convierte en los vaqueros que combinan con todo tu armario.",
      },
    },
  },
  "silk-blouse": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Silk Blouse",
        short: "Fluid pure-silk blouse with mother-of-pearl buttons - effortless day-to-night elegance.",
        desc: "Pure silk with a gentle sheen that catches the light, cut in a relaxed shape that skims rather than clings. Mother-of-pearl buttons and French seams speak to the details, while the fabric breathes in summer and layers in winter. From boardroom to dinner without a wardrobe change.",
      },
      sr: {
        title: "Svilena bluza",
        short: "Lepršava bluza od čiste svile sa sedefnim dugmadima - elegancija od jutra do večeri.",
        desc: "Čista svila blagog sjaja koji hvata svetlost, skrojena u opuštenoj formi koja klizi umesto da se pripija. Sedefna dugmad i francuski šavovi govore o detaljima, a tkanina diše leti i slaže se slojevito zimi. Od sastanka do večere bez presvlačenja.",
      },
      de: {
        title: "Seidenbluse",
        short: "Fließende Bluse aus reiner Seide mit Perlmuttknöpfen - mühelose Eleganz von früh bis spät.",
        desc: "Reine Seide mit sanftem Schimmer, der das Licht einfängt, geschnitten in einer entspannten Form, die umspielt statt anzuliegen. Perlmuttknöpfe und französische Nähte zeugen von Liebe zum Detail, während der Stoff im Sommer atmet und im Winter Schicht für Schicht wärmt. Vom Konferenzraum zum Abendessen ohne Umziehen.",
      },
      es: {
        title: "Blusa de seda",
        short: "Blusa fluida de pura seda con botones de nácar - elegancia sin esfuerzo de día a noche.",
        desc: "Pura seda con un brillo delicado que atrapa la luz, cortada en una forma relajada que acaricia en lugar de ceñir. Los botones de nácar y las costuras francesas hablan del detalle, mientras el tejido transpira en verano y se superpone en invierno. De la sala de juntas a la cena sin cambio de vestuario.",
      },
    },
  },
  "trench-coat": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Trench Coat",
        short: "Timeless water-repellent trench with a double-breasted front and waist belt.",
        desc: "Some designs never date: the double-breasted trench with storm flap, epaulettes and a waist belt that sharpens any outfit. The tightly woven cotton blend repels light rain, the back vent keeps your stride free, and the neutral tone works over office wear and weekend denim alike.",
      },
      sr: {
        title: "Trenčkot",
        short: "Bezvremenski vodoodbojni mantil sa dvorednim kopčanjem i pojasom u struku.",
        desc: "Neki krojevi ne stare: dvoredni trenčkot sa štitnikom od kiše, epoletama i pojasom koji izoštrava svaku kombinaciju. Gusto tkana mešavina pamuka odbija sitnu kišu, prorez pozadi ostavlja korak slobodnim, a neutralni ton ide preko poslovne garderobe kao i preko vikend farmerki.",
      },
      de: {
        title: "Trenchcoat",
        short: "Zeitloser wasserabweisender Trenchcoat mit Zweireiher-Front und Taillengürtel.",
        desc: "Manche Schnitte kommen nie aus der Mode: der zweireihige Trenchcoat mit Sturmklappe, Schulterklappen und Taillengürtel, der jedes Outfit schärft. Die dicht gewebte Baumwollmischung weist leichten Regen ab, der Rückenschlitz lässt den Schritt frei, und der neutrale Ton passt über Bürokleidung wie Wochenend-Denim.",
      },
      es: {
        title: "Gabardina",
        short: "Gabardina atemporal e hidrófuga con cierre cruzado y cinturón en la cintura.",
        desc: "Hay diseños que no envejecen: la gabardina cruzada con solapa cortavientos, hombreras y un cinturón que afina cualquier conjunto. Su mezcla de algodón de tejido denso repele la lluvia fina, la abertura trasera deja libre el paso y el tono neutro funciona sobre ropa de oficina igual que sobre el denim del fin de semana.",
      },
    },
  },
  "yoga-leggings": {
    brand: "nike",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Yoga Leggings",
        short: "Buttery-soft high-waist leggings with four-way stretch and a hidden pocket.",
        desc: "Made for movement, the Yoga Leggings combine buttery-soft fabric with four-way stretch that follows every pose and squat. The high waistband stays put without rolling, flatlock seams prevent chafing, and a hidden waistband pocket keeps a key or card secure through class.",
      },
      sr: {
        title: "Helanke za jogu",
        short: "Neverovatno mekane helanke visokog struka sa rastezanjem u četiri pravca i skrivenim džepom.",
        desc: "Stvorene za pokret, Helanke za jogu kombinuju izuzetno mekanu tkaninu sa rastezanjem u četiri pravca koje prati svaku pozu i čučanj. Visoki pojas stoji na mestu bez savijanja, flatlock šavovi sprečavaju žuljanje, a skriveni džep u pojasu čuva ključ ili karticu tokom treninga.",
      },
      de: {
        title: "Yoga-Leggings",
        short: "Butterweiche High-Waist-Leggings mit Vier-Wege-Stretch und verstecktem Täschchen.",
        desc: "Die Yoga-Leggings sind für Bewegung gemacht: butterweicher Stoff mit Vier-Wege-Stretch folgt jeder Pose und jeder Kniebeuge. Der hohe Bund bleibt an Ort und Stelle, ohne sich zu rollen, Flatlock-Nähte verhindern Scheuern, und ein verstecktes Bundtäschchen sichert Schlüssel oder Karte durch die ganze Stunde.",
      },
      es: {
        title: "Leggings de yoga",
        short: "Leggings de tiro alto supersuaves con elasticidad en cuatro direcciones y bolsillo oculto.",
        desc: "Hechos para el movimiento, los leggings de yoga combinan un tejido suavísimo con elasticidad en cuatro direcciones que acompaña cada postura y sentadilla. La cinturilla alta se queda en su sitio sin enrollarse, las costuras planas evitan rozaduras y un bolsillo oculto guarda la llave o la tarjeta durante la clase.",
      },
    },
  },
  "kids-graphic-tee": {
    brand: "hm",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Kids Graphic Tee",
        short: "Fun printed tee in 100% cotton that survives playgrounds and washing machines alike.",
        desc: "A tee kids actually want to wear: playful prints in colors that stay bright, pure cotton that is gentle on skin, and a roomy cut that survives climbing frames and cartwheel practice. Pre-shrunk and machine washable at 40°, because kids will be kids.",
      },
      sr: {
        title: "Dečija majica sa štampom",
        short: "Vesela štampana majica od 100% pamuka koja preživljava i igralište i veš mašinu.",
        desc: "Majica koju deca zaista žele da nose: razigrane štampe u bojama koje ostaju žive, čist pamuk nežan prema koži i komotan kroj koji preživljava penjalice i vežbanje zvezde. Predskupljena i periva u mašini na 40°, jer deca će biti deca.",
      },
      de: {
        title: "Kinder-T-Shirt mit Print",
        short: "Fröhlich bedrucktes Shirt aus 100% Baumwolle, das Spielplatz und Waschmaschine übersteht.",
        desc: "Ein Shirt, das Kinder wirklich tragen wollen: verspielte Prints in Farben, die leuchtend bleiben, reine Baumwolle, die sanft zur Haut ist, und ein bequemer Schnitt, der Klettergerüst und Radschlag-Training übersteht. Vorgewaschen und maschinenwaschbar bei 40° - denn Kinder bleiben Kinder.",
      },
      es: {
        title: "Camiseta infantil estampada",
        short: "Divertida camiseta estampada de 100% algodón que sobrevive al parque y a la lavadora.",
        desc: "Una camiseta que los niños quieren ponerse: estampados divertidos en colores que no se apagan, algodón puro suave con la piel y un corte holgado que aguanta trepadores y volteretas. Prelavada y lavable a máquina a 40°, porque los niños son niños.",
      },
    },
  },
  "kids-hoodie": {
    brand: "nike",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Kids Hoodie",
        short: "Cozy fleece-lined kids hoodie with a safe hood design and easy-zip front.",
        desc: "Playground-ready warmth: this kids hoodie lines soft fleece inside a sturdy cotton-blend shell, with a hood designed without drawstrings for safety and a chunky zip little fingers can work alone. Ribbed cuffs keep sleeves in place during monkey-bar missions.",
      },
      sr: {
        title: "Dečiji duks",
        short: "Topao dečiji duks postavljen flisom, sa bezbednom kapuljačom i rajsferšlusom koji deca sama zakopčavaju.",
        desc: "Toplota spremna za igralište: ovaj dečiji duks oblaže mekan flis u čvrstu školjku od mešavine pamuka, sa kapuljačom bez pertli radi bezbednosti i krupnim rajsferšlusom koji mali prsti sami savladaju. Rebraste manžetne drže rukave na mestu tokom misija na penjalici.",
      },
      de: {
        title: "Kinder-Kapuzenpullover",
        short: "Kuscheliger fleecegefütterter Kinder-Hoodie mit sicherer Kapuze und leichtgängigem Reißverschluss.",
        desc: "Wärme für den Spielplatz: Dieser Kinder-Hoodie steckt weiches Fleece in eine robuste Baumwollmisch-Hülle, mit einer aus Sicherheitsgründen kordellosen Kapuze und einem griffigen Reißverschluss, den kleine Finger allein schaffen. Rippbündchen halten die Ärmel bei Klettergerüst-Missionen an Ort und Stelle.",
      },
      es: {
        title: "Sudadera infantil con capucha",
        short: "Acogedora sudadera infantil forrada de felpa, con capucha segura y cremallera fácil de usar.",
        desc: "Abrigo listo para el parque: esta sudadera infantil forra felpa suave en un exterior resistente de mezcla de algodón, con una capucha sin cordones por seguridad y una cremallera gruesa que los dedos pequeños manejan solos. Los puños de canalé mantienen las mangas en su sitio durante las misiones en las barras.",
      },
    },
  },
  "kids-joggers": {
    brand: "adidas",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Kids Joggers",
        short: "Stretchy, durable kids joggers with reinforced knees and an adjustable waist.",
        desc: "Built for kids who never sit still: stretchy jersey joggers with reinforced knees that survive slides and scrapes, an elastic waist with an inner drawcord that grows with them, and zip pockets that keep treasures from falling out mid-adventure.",
      },
      sr: {
        title: "Dečije trenerke",
        short: "Rastegljive, izdržljive dečije trenerke sa ojačanim kolenima i podesivim strukom.",
        desc: "Napravljene za decu koja ne sede mirno: rastegljive trenerke od žerseja sa ojačanim kolenima koja preživljavaju tobogane i ogrebotine, elastičan struk sa unutrašnjom vezicom koji raste sa njima i džepovi sa rajsferšlusom iz kojih blago ne ispada usred avanture.",
      },
      de: {
        title: "Kinder-Jogginghose",
        short: "Dehnbare, robuste Kinder-Jogginghose mit verstärkten Knien und verstellbarem Bund.",
        desc: "Gemacht für Kinder, die nie stillsitzen: dehnbare Jersey-Jogginghose mit verstärkten Knien, die Rutschen und Schrammen überstehen, ein Gummibund mit innerem Kordelzug, der mitwächst, und Reißverschlusstaschen, aus denen mitten im Abenteuer keine Schätze fallen.",
      },
      es: {
        title: "Joggers infantiles",
        short: "Joggers infantiles elásticos y resistentes con rodillas reforzadas y cintura ajustable.",
        desc: "Hechos para niños que no paran quietos: joggers de punto elástico con rodillas reforzadas que sobreviven a toboganes y raspones, cintura elástica con cordón interior que crece con ellos y bolsillos con cremallera para que los tesoros no se pierdan en plena aventura.",
      },
    },
  },
  "running-sneakers": {
    brand: "nike",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Running Sneakers",
        short: "Responsive cushioned running shoes with a breathable knit upper - born for daily miles.",
        desc: "Daily miles feel easier in the Running Sneakers: responsive foam cushioning returns energy with every stride, the engineered knit upper breathes and hugs the midfoot, and the durable rubber outsole grips wet pavement with confidence. Light enough to forget, supportive enough to go long.",
      },
      sr: {
        title: "Patike za trčanje",
        short: "Patike za trčanje sa responzivnim đonom i prozračnim pletenim gornjištem - rođene za svakodnevne kilometre.",
        desc: "Svakodnevni kilometri lakši su u ovim patikama: responzivna pena vraća energiju sa svakim korakom, projektovano pleteno gornjište diše i obgrli srednji deo stopala, a izdržljiv gumeni đon sigurno prianja i na mokrom asfaltu. Dovoljno lagane da ih zaboravite, dovoljno stabilne za duge deonice.",
      },
      de: {
        title: "Laufschuhe",
        short: "Reaktionsfreudig gedämpfte Laufschuhe mit atmungsaktivem Strick-Obermaterial für tägliche Kilometer.",
        desc: "Tägliche Kilometer fühlen sich in diesen Laufschuhen leichter an: Der reaktive Schaum gibt mit jedem Schritt Energie zurück, das gestrickte Obermaterial atmet und umschließt den Mittelfuß, und die robuste Gummisohle greift zuverlässig auch auf nassem Asphalt. Leicht genug zum Vergessen, stabil genug für lange Läufe.",
      },
      es: {
        title: "Zapatillas de running",
        short: "Zapatillas de running con amortiguación reactiva y parte superior de punto transpirable - nacidas para los kilómetros diarios.",
        desc: "Los kilómetros diarios se hacen más fáciles con estas zapatillas: la espuma reactiva devuelve energía en cada zancada, el tejido de punto transpira y abraza el mediopié, y la suela de goma duradera agarra con confianza el asfalto mojado. Tan ligeras que las olvidas, tan estables que aguantan tiradas largas.",
      },
    },
  },
  "leather-boots": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Leather Boots",
        short: "Full-grain leather boots with a cushioned insole - handsome now, better in five years.",
        desc: "Real full-grain leather that scuffs, weathers and gets more handsome every year. These boots pair a Goodyear-inspired welted construction with a cushioned insole, so they are ready for city blocks the day you unbox them and still resoleable a decade later.",
      },
      sr: {
        title: "Kožne čizme",
        short: "Čizme od pune kože sa mekanim uloškom - lepe odmah, još lepše za pet godina.",
        desc: "Prava puna koža koja se grebe, pati od vremena i svake godine izgleda sve bolje. Ove čizme spajaju konstrukciju inspirisanu Goodyear ramom sa mekanim uloškom, pa su spremne za gradske ulice čim ih raspakujete, a mogu na novo đonjenje i deceniju kasnije.",
      },
      de: {
        title: "Lederstiefel",
        short: "Stiefel aus Vollnarbenleder mit gepolsterter Innensohle - schön heute, schöner in fünf Jahren.",
        desc: "Echtes Vollnarbenleder, das Kratzer und Wetter sammelt und jedes Jahr besser aussieht. Diese Stiefel verbinden eine rahmengenähte Machart nach Goodyear-Vorbild mit einer gepolsterten Innensohle - bereit für Stadtstraßen ab dem ersten Tag und auch nach einem Jahrzehnt noch neu besohlbar.",
      },
      es: {
        title: "Botas de piel",
        short: "Botas de piel plena flor con plantilla acolchada - bonitas hoy, mejores dentro de cinco años.",
        desc: "Piel plena flor auténtica que se roza, se curte y gana atractivo cada año. Estas botas combinan una construcción cosida inspirada en el Goodyear con una plantilla acolchada: listas para la ciudad desde que las sacas de la caja y con suela reemplazable una década después.",
      },
    },
  },
  "canvas-low-tops": {
    brand: "adidas",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Canvas Low-Tops",
        short: "Classic canvas sneakers with a vulcanized sole - the go-with-everything shoe.",
        desc: "Some shoes never go out of style. These canvas low-tops keep the classic recipe: durable cotton canvas, a vulcanized rubber sole with just-right flex, and a clean toe cap. They work with jeans, chinos and shorts, and only look better as they break in.",
      },
      sr: {
        title: "Platnene patike",
        short: "Klasične platnene patike sa vulkanizovanim đonom - obuća koja ide uz sve.",
        desc: "Neke patike nikada ne izlaze iz mode. Ove platnene niske patike drže se klasičnog recepta: izdržljivo pamučno platno, vulkanizovan gumeni đon sa taman pravom savitljivošću i čista kapica na vrhu. Idu uz farmerke, činose i šorc, a izgledaju sve bolje što se više razgaze.",
      },
      de: {
        title: "Canvas-Sneaker",
        short: "Klassische Canvas-Sneaker mit vulkanisierter Sohle - der Schuh, der zu allem passt.",
        desc: "Manche Schuhe kommen nie aus der Mode. Diese niedrigen Canvas-Sneaker bleiben beim klassischen Rezept: strapazierfähiges Baumwollcanvas, eine vulkanisierte Gummisohle mit genau richtiger Flexibilität und eine saubere Zehenkappe. Sie passen zu Jeans, Chinos und Shorts - und werden mit jedem Tragen schöner.",
      },
      es: {
        title: "Zapatillas de lona",
        short: "Zapatillas clásicas de lona con suela vulcanizada - el calzado que combina con todo.",
        desc: "Hay zapatillas que nunca pasan de moda. Estas zapatillas bajas de lona mantienen la receta clásica: lona de algodón resistente, suela de goma vulcanizada con la flexibilidad justa y una puntera limpia. Van con vaqueros, chinos y pantalones cortos, y mejoran a medida que se amoldan.",
      },
    },
  },
  "trail-hiking-shoes": {
    brand: "adidas",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Trail Hiking Shoes",
        short: "Grippy, waterproof hiking shoes that are light enough for all-day trails.",
        desc: "From forest paths to rocky ridgelines, these hiking shoes bite into terrain with a deep-lug outsole and shrug off puddles with a waterproof membrane. The cushioned midsole and protective toe cap take the sting out of long descents, at a weight closer to a sneaker than a boot.",
      },
      sr: {
        title: "Cipele za planinarenje",
        short: "Vodootporne planinarske cipele odličnog prianjanja, dovoljno lake za celodnevne staze.",
        desc: "Od šumskih staza do kamenitih grebena, ove planinarske cipele grizu teren dubokim šarama đona i odbijaju bare vodootpornom membranom. Amortizovani međuđon i zaštitna kapica ublažavaju duge spustove, uz težinu bližu patici nego cokuli.",
      },
      de: {
        title: "Trail-Wanderschuhe",
        short: "Griffige, wasserdichte Wanderschuhe - leicht genug für ganztägige Touren.",
        desc: "Von Waldwegen bis zu felsigen Graten: Diese Wanderschuhe beißen sich mit tiefem Sohlenprofil ins Gelände und trotzen Pfützen mit wasserdichter Membran. Die gedämpfte Zwischensohle und die schützende Zehenkappe nehmen langen Abstiegen die Härte - bei einem Gewicht, das näher am Sneaker als am Bergstiefel liegt.",
      },
      es: {
        title: "Zapatillas de senderismo",
        short: "Zapatillas de senderismo impermeables y con gran agarre, ligeras para rutas de todo el día.",
        desc: "De senderos de bosque a crestas rocosas, estas zapatillas muerden el terreno con una suela de tacos profundos y esquivan los charcos con su membrana impermeable. La mediasuela amortiguada y la puntera protectora suavizan los descensos largos, con un peso más cercano a una zapatilla que a una bota.",
      },
    },
  },
  "court-sneakers": {
    brand: "nike",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Court Sneakers",
        short: "Clean retro court sneakers in leather - the minimalist pair that elevates any outfit.",
        desc: "Inspired by 1970s tennis courts, these leather sneakers keep it minimal: smooth uppers, tonal laces and a cupsole that cushions city miles. The clean lines dress up with trousers as easily as they dress down with denim - a true one-pair-does-it-all.",
      },
      sr: {
        title: "Klasične patike",
        short: "Čiste retro teniske patike od kože - minimalistički par koji podiže svaku kombinaciju.",
        desc: "Inspirisane teniskim terenima sedamdesetih, ove kožne patike ostaju minimalne: glatko gornjište, pertle u tonu i cupsole đon koji amortizuje gradske kilometre. Čiste linije podjednako lako idu uz pantalone kao i uz farmerke - zaista jedan par za sve.",
      },
      de: {
        title: "Court-Sneaker",
        short: "Cleane Retro-Court-Sneaker aus Leder - das minimalistische Paar, das jedes Outfit hebt.",
        desc: "Inspiriert von den Tennisplätzen der 1970er bleiben diese Ledersneaker minimalistisch: glattes Obermaterial, Ton-in-Ton-Schnürsenkel und eine Cupsole, die Stadtkilometer dämpft. Die klaren Linien passen zur Stoffhose genauso mühelos wie zur Jeans - wirklich ein Paar für alles.",
      },
      es: {
        title: "Zapatillas de pista",
        short: "Zapatillas retro de piel de líneas limpias - el par minimalista que eleva cualquier conjunto.",
        desc: "Inspiradas en las pistas de tenis de los años 70, estas zapatillas de piel apuestan por lo esencial: empeine liso, cordones al tono y una suela cupsole que amortigua los kilómetros urbanos. Sus líneas limpias combinan con pantalón de vestir tan fácilmente como con denim - un solo par para todo.",
      },
    },
  },
  "leather-backpack": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Leather Backpack",
        short: "Refined leather backpack with a padded 15-inch laptop sleeve and magnetic closures.",
        desc: "The Leather Backpack carries your work life beautifully: a padded sleeve protects laptops up to 15 inches, interior organizer pockets keep chargers and notebooks in order, and magnetic closures open with one hand. Full-grain leather ages into a rich patina that makes the bag unmistakably yours.",
      },
      sr: {
        title: "Kožni ranac",
        short: "Elegantan kožni ranac sa postavljenom pregradom za laptop od 15 inča i magnetnim kopčama.",
        desc: "Kožni ranac nosi vaš poslovni život sa stilom: postavljena pregrada štiti laptopove do 15 inča, unutrašnji organizator drži punjače i sveske u redu, a magnetne kopče otvaraju se jednom rukom. Puna koža vremenom dobija bogatu patinu koja ranac čini nepogrešivo vašim.",
      },
      de: {
        title: "Lederrucksack",
        short: "Edler Lederrucksack mit gepolstertem 15-Zoll-Laptopfach und Magnetverschlüssen.",
        desc: "Der Lederrucksack trägt Ihren Arbeitsalltag mit Stil: Ein gepolstertes Fach schützt Laptops bis 15 Zoll, Organizer-Taschen halten Ladegeräte und Notizbücher in Ordnung, und Magnetverschlüsse öffnen sich mit einer Hand. Das Vollnarbenleder entwickelt mit der Zeit eine satte Patina, die den Rucksack unverwechselbar macht.",
      },
      es: {
        title: "Mochila de piel",
        short: "Mochila de piel refinada con funda acolchada para portátil de 15 pulgadas y cierres magnéticos.",
        desc: "La mochila de piel lleva tu vida laboral con elegancia: una funda acolchada protege portátiles de hasta 15 pulgadas, los bolsillos organizadores mantienen en orden cargadores y cuadernos, y los cierres magnéticos se abren con una mano. La piel plena flor envejece con una pátina rica que la hace inconfundiblemente tuya.",
      },
    },
  },
  "tote-bag": {
    brand: "hm",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Tote Bag",
        short: "Roomy structured tote in durable canvas with an inner zip pocket and laptop space.",
        desc: "The everything bag: groceries, gym kit, a 14-inch laptop - the structured canvas tote swallows it all and keeps its shape. An inner zip pocket secures keys and cards, the reinforced handles are stitched to carry real weight, and the wipe-clean base handles café floors and cobblestones.",
      },
      sr: {
        title: "Tote torba",
        short: "Prostrana strukturirana tote torba od izdržljivog platna sa unutrašnjim džepom na rajsferšlus.",
        desc: "Torba za sve: namirnice, oprema za teretanu, laptop od 14 inča - strukturirana platnena tote torba guta sve i zadržava formu. Unutrašnji džep na rajsferšlus čuva ključeve i kartice, ojačane ručke prošivene su da nose pravu težinu, a dno koje se briše krpom podnosi podove kafića i kaldrmu.",
      },
      de: {
        title: "Tote Bag",
        short: "Geräumiger strukturierter Shopper aus robustem Canvas mit Reißverschluss-Innentasche und Laptopfach.",
        desc: "Die Tasche für alles: Einkäufe, Sportsachen, ein 14-Zoll-Laptop - der strukturierte Canvas-Shopper schluckt alles und behält seine Form. Eine Reißverschluss-Innentasche sichert Schlüssel und Karten, die verstärkten Henkel sind für echtes Gewicht vernäht, und der abwischbare Boden verzeiht Caféböden wie Kopfsteinpflaster.",
      },
      es: {
        title: "Bolso tote",
        short: "Amplio bolso tote estructurado de lona resistente con bolsillo interior de cremallera y espacio para portátil.",
        desc: "El bolso para todo: la compra, la ropa del gimnasio, un portátil de 14 pulgadas - este tote de lona estructurada lo traga todo y conserva la forma. Un bolsillo interior con cremallera asegura llaves y tarjetas, las asas reforzadas están cosidas para cargar peso de verdad y la base lavable soporta suelos de cafetería y adoquines.",
      },
    },
  },
  "crossbody-bag": {
    brand: "zara",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Crossbody Bag",
        short: "Compact crossbody bag with an adjustable strap and smart compartments for essentials.",
        desc: "Hands-free and organized: the Crossbody Bag holds phone, wallet, keys and sunglasses in dedicated compartments, so nothing rattles loose. The adjustable strap sits comfortably across any frame, and the scratch-resistant finish keeps it looking sharp through daily wear.",
      },
      sr: {
        title: "Crossbody torbica",
        short: "Kompaktna torbica preko tela sa podesivim kaišem i pametnim pregradama za sitnice.",
        desc: "Slobodne ruke i sve na svom mestu: Crossbody torbica drži telefon, novčanik, ključeve i naočare u posebnim pregradama, pa ništa ne zvecka. Podesivi kaiš udobno naleže na svaku građu, a završnica otporna na ogrebotine čuva uredan izgled i uz svakodnevno nošenje.",
      },
      de: {
        title: "Umhängetasche",
        short: "Kompakte Crossbody-Tasche mit verstellbarem Riemen und cleveren Fächern für das Nötigste.",
        desc: "Freihändig und organisiert: Die Umhängetasche verstaut Handy, Portemonnaie, Schlüssel und Sonnenbrille in eigenen Fächern - nichts fliegt lose herum. Der verstellbare Riemen sitzt bei jeder Statur bequem, und die kratzfeste Oberfläche hält die Tasche auch im Alltag ansehnlich.",
      },
      es: {
        title: "Bolso bandolera",
        short: "Bolso bandolera compacto con correa ajustable y compartimentos inteligentes para lo esencial.",
        desc: "Manos libres y todo en orden: el bolso bandolera guarda móvil, cartera, llaves y gafas de sol en compartimentos propios, para que nada baile suelto. La correa ajustable se adapta cómodamente a cualquier constitución y el acabado resistente a arañazos lo mantiene impecable en el uso diario.",
      },
    },
  },
  "leather-wallet": {
    brand: "levis",
    variants: { mode: "keep" },
    t: {
      en: {
        title: "Leather Wallet",
        short: "Slim full-grain leather wallet with RFID blocking and room for eight cards.",
        desc: "Slim enough for a front pocket, smart enough for the times: this full-grain leather wallet holds eight cards and folded notes while RFID-blocking lining shields them from wireless skimming. The leather burnishes with use, turning everyday wear into character.",
      },
      sr: {
        title: "Kožni novčanik",
        short: "Tanak novčanik od pune kože sa RFID zaštitom i mestom za osam kartica.",
        desc: "Dovoljno tanak za prednji džep, dovoljno pametan za današnje vreme: ovaj novčanik od pune kože prima osam kartica i presavijene novčanice, dok RFID postava štiti od bežičnog očitavanja. Koža se glača upotrebom i svakodnevno nošenje pretvara u karakter.",
      },
      de: {
        title: "Ledergeldbörse",
        short: "Schlanke Geldbörse aus Vollnarbenleder mit RFID-Schutz und Platz für acht Karten.",
        desc: "Schlank genug für die Vordertasche, klug genug für heutige Zeiten: Diese Geldbörse aus Vollnarbenleder fasst acht Karten und gefaltete Scheine, während das RFID-blockierende Futter vor drahtlosem Auslesen schützt. Das Leder poliert sich mit dem Gebrauch - Alltagsspuren werden zu Charakter.",
      },
      es: {
        title: "Cartera de piel",
        short: "Cartera fina de piel plena flor con bloqueo RFID y espacio para ocho tarjetas.",
        desc: "Lo bastante fina para el bolsillo delantero y lo bastante lista para estos tiempos: esta cartera de piel plena flor guarda ocho tarjetas y billetes doblados, mientras su forro con bloqueo RFID los protege de lecturas inalámbricas. La piel se pule con el uso, convirtiendo el desgaste diario en carácter.",
      },
    },
  },
};
