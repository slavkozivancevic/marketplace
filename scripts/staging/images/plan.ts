// Image shot list for the 45-product representative set (mirrors the
// published guide artifact). Each product folder gets one file per shot.
export type Shot = { name: string; query: string };
export type ProductPlan = { slug: string; title: string; shots: Shot[]; note?: string };

export const plan: ProductPlan[] = [
  // ── Electronics ──────────────────────────────────────────────────────────
  { slug: "ultrabook-pro-14", title: "UltraBook Pro 14", shots: [
    { name: "black", query: "black ultrabook laptop open angle white background" },
    { name: "blue", query: "navy blue slim laptop open angle studio photo" },
  ]},
  { slug: "office-laptop-15", title: "Office Laptop 15", shots: [
    { name: "hero", query: "business laptop 15 inch on desk product photo" },
  ]},
  { slug: "workstation-tower", title: "Workstation Tower", shots: [
    { name: "gray", query: "gray desktop PC tower white background" },
    { name: "black", query: "black desktop PC tower white background" },
  ]},
  { slug: "galaxy-phone-s", title: "Galaxy Phone S", shots: [
    { name: "green", query: "green android smartphone studio photo" },
    { name: "black", query: "black android smartphone studio photo" },
    { name: "white", query: "white android smartphone studio photo" },
  ]},
  { slug: "foldable-phone-z", title: "Foldable Phone Z", shots: [
    { name: "gray", query: "gray foldable smartphone half open studio photo" },
    { name: "blue", query: "blue foldable smartphone half open studio photo" },
    { name: "black", query: "black foldable smartphone half open studio photo" },
  ]},
  { slug: "4k-smart-tv-55", title: "4K Smart TV 55", shots: [
    { name: "black", query: "large flat screen smart tv on stand front view" },
  ]},
  { slug: "oled-tv-65", title: "OLED TV 65", shots: [
    { name: "hero", query: "thin bezel oled tv on wall living room" },
  ]},
  { slug: "wireless-headphones", title: "Wireless Headphones", shots: [
    { name: "black", query: "black over ear wireless headphones white background" },
    { name: "blue", query: "blue over ear wireless headphones white background" },
  ]},
  { slug: "mirrorless-camera", title: "Mirrorless Camera", shots: [
    { name: "white", query: "white mirrorless camera with lens studio photo" },
  ]},
  { slug: "dslr-kit", title: "DSLR Kit", shots: [
    { name: "hero", query: "dslr camera with zoom lens kit white background" },
  ]},
  { slug: "game-console-x", title: "Game Console X", shots: [
    { name: "white", query: "white game console with controller studio photo" },
    { name: "green", query: "green limited edition game console studio photo" },
  ]},
  { slug: "mechanical-keyboard", title: "Mechanical Keyboard", shots: [
    { name: "gray", query: "gray mechanical keyboard top view studio photo" },
    { name: "white", query: "white mechanical keyboard top view studio photo" },
    { name: "black", query: "black mechanical keyboard rgb top view studio photo" },
  ]},

  // ── Fashion ──────────────────────────────────────────────────────────────
  { slug: "classic-cotton-t-shirt", title: "Classic Cotton T-Shirt", shots: [
    { name: "red", query: "red crew neck t-shirt flat lay white background" },
    { name: "black", query: "black crew neck t-shirt flat lay white background" },
    { name: "white", query: "white crew neck t-shirt flat lay white background" },
  ], note: "Boja se dodeljuje na SVA 4 reda te boje (S/M/L/XL) - veličina nema svoju sliku." },
  { slug: "oxford-shirt", title: "Oxford Shirt", shots: [
    { name: "black", query: "black oxford button down shirt on hanger product photo" },
    { name: "gray", query: "gray oxford button down shirt on hanger product photo" },
    { name: "green", query: "olive green oxford button down shirt on hanger product photo" },
  ]},
  { slug: "summer-dress", title: "Summer Dress", shots: [
    { name: "blue", query: "blue wrap summer dress on model studio photo" },
    { name: "black", query: "black wrap summer dress on model studio photo" },
    { name: "red", query: "red wrap summer dress on model studio photo" },
  ]},
  { slug: "yoga-leggings", title: "Yoga Leggings", shots: [
    { name: "red", query: "red high waist yoga leggings product photo" },
    { name: "gray", query: "gray high waist yoga leggings product photo" },
  ]},
  { slug: "kids-hoodie", title: "Kids Hoodie", shots: [
    { name: "white", query: "white kids hoodie flat lay product photo" },
    { name: "red", query: "red kids hoodie flat lay product photo" },
    { name: "blue", query: "blue kids hoodie flat lay product photo" },
  ]},
  { slug: "running-sneakers", title: "Running Sneakers", shots: [
    { name: "white", query: "white running sneakers side view white background" },
    { name: "red", query: "red running sneakers side view white background" },
    { name: "gray", query: "gray running sneakers side view white background" },
  ]},
  { slug: "leather-boots", title: "Leather Boots", shots: [
    { name: "white", query: "off white leather ankle boots side view studio photo" },
    { name: "blue", query: "navy blue leather ankle boots side view studio photo" },
  ]},
  { slug: "leather-backpack", title: "Leather Backpack", shots: [
    { name: "yellow", query: "tan leather backpack white background" },
    { name: "black", query: "black leather backpack white background" },
    { name: "gray", query: "gray leather backpack white background" },
  ]},
  { slug: "leather-wallet", title: "Leather Wallet", shots: [
    { name: "white", query: "ivory leather bifold wallet white background" },
    { name: "yellow", query: "tan leather bifold wallet white background" },
  ]},

  // ── Home & Garden ────────────────────────────────────────────────────────
  { slug: "fabric-sofa-3-seat", title: "Fabric Sofa 3-Seat", shots: [
    { name: "gray", query: "gray fabric 3 seat sofa living room white background" },
    { name: "black", query: "black fabric 3 seat sofa living room white background" },
    { name: "blue", query: "blue fabric 3 seat sofa living room white background" },
  ]},
  { slug: "oak-coffee-table", title: "Oak Coffee Table", shots: [
    { name: "hero", query: "solid oak coffee table with shelf white background" },
  ]},
  { slug: "ergonomic-office-chair", title: "Ergonomic Office Chair", shots: [
    { name: "hero", query: "ergonomic mesh office chair white background" },
  ]},
  { slug: "espresso-machine", title: "Espresso Machine", shots: [
    { name: "white", query: "white espresso machine with steam wand kitchen counter" },
  ]},
  { slug: "stainless-knife-block", title: "Stainless Knife Block", shots: [
    { name: "hero", query: "stainless steel kitchen knife set wooden block" },
  ]},
  { slug: "scented-candle-set", title: "Scented Candle Set", shots: [
    { name: "white", query: "white glass jar scented candle set of three" },
    { name: "blue", query: "blue glass jar scented candle" },
  ]},

  // ── Sports & Outdoors ────────────────────────────────────────────────────
  { slug: "yoga-mat-pro", title: "Yoga Mat Pro", shots: [
    { name: "black", query: "black yoga mat rolled and unrolled studio photo" },
    { name: "green", query: "green yoga mat rolled and unrolled studio photo" },
  ]},
  { slug: "adjustable-dumbbells", title: "Adjustable Dumbbells", shots: [
    { name: "hero", query: "adjustable dumbbell pair white background" },
  ]},
  { slug: "2-person-tent", title: "2-Person Tent", shots: [
    { name: "gray", query: "gray two person camping tent pitched outdoors" },
    { name: "yellow", query: "yellow two person camping tent pitched outdoors" },
    { name: "black", query: "dark gray two person camping tent pitched outdoors" },
  ]},
  { slug: "hiking-backpack-40l", title: "Hiking Backpack 40L", shots: [
    { name: "green", query: "green 40l hiking backpack white background" },
    { name: "red", query: "red 40l hiking backpack white background" },
    { name: "yellow", query: "orange yellow 40l hiking backpack white background" },
  ]},
  { slug: "mountain-bike-29", title: "Mountain Bike 29", shots: [
    { name: "gray", query: "gray hardtail mountain bike side view white background" },
    { name: "black", query: "black hardtail mountain bike side view white background" },
  ]},
  { slug: "cycling-helmet", title: "Cycling Helmet", shots: [
    { name: "gray", query: "gray road cycling helmet white background" },
    { name: "red", query: "red road cycling helmet white background" },
  ]},

  // ── Books & Games ────────────────────────────────────────────────────────
  { slug: "the-pragmatic-developer", title: "The Pragmatic Developer", shots: [
    { name: "hero", query: "software engineering book cover mockup white background" },
  ]},
  { slug: "cooking-basics", title: "Cooking Basics", shots: [
    { name: "hero", query: "illustrated cookbook hardcover white background" },
  ]},
  { slug: "open-world-rpg", title: "Open World RPG", shots: [
    { name: "hero", query: "fantasy open world rpg video game cover art box mockup" },
  ], note: "1 slika -> dodeli na sva 3 reda (PlayStation, Xbox, PC)." },
  { slug: "racing-sim-2026", title: "Racing Sim 2026", shots: [
    { name: "hero", query: "racing simulator video game cover art box mockup" },
  ], note: "1 slika -> dodeli na sva 3 reda (PlayStation, Xbox, PC)." },

  // ── Health & Beauty ──────────────────────────────────────────────────────
  { slug: "hydrating-serum", title: "Hydrating Serum", shots: [
    { name: "hero", query: "hyaluronic acid serum dropper bottle white background" },
  ], note: "1 slika -> dodeli na oba reda (30ml, 50ml)." },
  { slug: "spf-50-sunscreen", title: "SPF 50 Sunscreen", shots: [
    { name: "hero", query: "spf 50 sunscreen tube white background" },
  ], note: "1 slika -> dodeli na oba reda (100ml, 200ml)." },
  { slug: "eau-de-parfum-noir", title: "Eau de Parfum Noir", shots: [
    { name: "hero", query: "dark glass perfume bottle black studio photo" },
  ], note: "1 slika -> dodeli na oba reda (50ml, 100ml)." },

  // ── Toys & Kids ──────────────────────────────────────────────────────────
  { slug: "building-bricks-1000pc", title: "Building Bricks 1000pc", shots: [
    { name: "hero", query: "colorful building bricks box set white background" },
  ]},
  { slug: "remote-control-car", title: "Remote Control Car", shots: [
    { name: "red", query: "red remote control toy car off-road white background" },
    { name: "gray", query: "gray remote control toy car off-road white background" },
  ]},
  { slug: "stroller-lite", title: "Stroller Lite", shots: [
    { name: "black", query: "black lightweight baby stroller folded white background" },
    { name: "white", query: "gray light baby stroller side view white background" },
    { name: "red", query: "red lightweight baby stroller side view white background" },
  ]},

  // ── Automotive ───────────────────────────────────────────────────────────
  { slug: "dash-cam-1080p", title: "Dash Cam 1080p", shots: [
    { name: "hero", query: "dash cam mounted on windshield product photo" },
  ]},
  { slug: "cordless-drill-18v", title: "Cordless Drill 18V", shots: [
    { name: "hero", query: "cordless power drill with battery white background" },
  ]},
  { slug: "socket-wrench-set", title: "Socket Wrench Set", shots: [
    { name: "hero", query: "socket wrench set case 72 pieces white background" },
  ], note: "Dodeli i na jedini preostali (Green) red varijante." },
];
