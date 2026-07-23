// Second batch: the remaining 46 products (of 94) not covered by plan.ts.
// Excludes the 2 hand-authored products (Aurora X1, Classic Cotton Crewneck)
// which already have real photos. Same shape as plan.ts.
import type { ProductPlan } from "./plan";

export const plan2: ProductPlan[] = [
  // ── Electronics (16) ─────────────────────────────────────────────────────
  { slug: "action-camera-4k", title: "Action Camera 4K", shots: [
    { name: "black", query: "black action camera studio photo" },
    { name: "gray", query: "gray action camera studio photo" },
  ]},
  { slug: "bluetooth-speaker", title: "Bluetooth Speaker", shots: [
    { name: "green", query: "green portable bluetooth speaker white background" },
    { name: "red", query: "red portable bluetooth speaker white background" },
  ]},
  { slug: "budget-phone-lite", title: "Budget Phone Lite", shots: [
    { name: "green", query: "green android smartphone back cover" },
    { name: "gray", query: "gray android smartphone studio photo" },
    { name: "red", query: "red android smartphone studio photo" },
  ]},
  { slug: "convertible-2-in-1", title: "Convertible 2-in-1", shots: [
    { name: "white", query: "white 2 in 1 laptop tablet mode studio" },
    { name: "black", query: "black 2 in 1 laptop tablet mode studio" },
  ]},
  { slug: "gaming-headset", title: "Gaming Headset", shots: [
    { name: "gray", query: "gray gaming headset white background" },
    { name: "black", query: "black gaming headset with microphone studio photo" },
  ]},
  { slug: "gaming-notebook-x", title: "Gaming Notebook X", shots: [
    { name: "black", query: "black gaming laptop rgb keyboard open" },
  ]},
  { slug: "mini-tablet-8", title: "Mini Tablet 8", shots: [
    { name: "white", query: "white small tablet studio photo" },
    { name: "blue", query: "blue small tablet studio photo" },
    { name: "red", query: "red small tablet studio photo" },
  ]},
  { slug: "noise-cancel-earbuds", title: "Noise-Cancel Earbuds", shots: [
    { name: "red", query: "red wireless earbuds charging case studio" },
    { name: "blue", query: "blue wireless earbuds charging case studio" },
  ]},
  { slug: "pro-max-smartphone", title: "Pro Max Smartphone", shots: [
    { name: "black", query: "black smartphone triple camera studio photo" },
    { name: "green", query: "green smartphone triple camera studio photo" },
    { name: "blue", query: "blue smartphone triple camera studio photo" },
  ]},
  { slug: "soundbar-2-1", title: "Soundbar 2.1", shots: [
    { name: "gray", query: "gray soundbar speaker tv stand" },
  ]},
  { slug: "student-chromebook", title: "Student Chromebook", shots: [
    { name: "white", query: "white laptop open studio photo" },
    { name: "black", query: "black laptop open studio photo" },
  ]},
  { slug: "studio-over-ear", title: "Studio Over-Ear", shots: [
    { name: "blue", query: "blue studio headphones white background" },
    { name: "green", query: "green studio headphones white background" },
  ]},
  { slug: "tablet-air-11", title: "Tablet Air 11", shots: [
    { name: "red", query: "red tablet studio photo" },
    { name: "black", query: "black tablet studio photo" },
    { name: "blue", query: "blue tablet studio photo" },
  ]},
  { slug: "vlogging-camera", title: "Vlogging Camera", shots: [
    { name: "black", query: "black compact vlogging camera flip screen" },
  ]},
  { slug: "wireless-controller", title: "Wireless Controller", shots: [
    { name: "black", query: "black game controller white background" },
    { name: "blue", query: "blue game controller white background" },
  ]},
  { slug: "car-bluetooth-adapter", title: "Car Bluetooth Adapter", shots: [
    { name: "hero", query: "bluetooth car adapter dongle product photo" },
  ]},

  // ── Fashion (15) ─────────────────────────────────────────────────────────
  { slug: "canvas-low-tops", title: "Canvas Low-Tops", shots: [
    { name: "green", query: "green canvas sneakers white background" },
    { name: "black", query: "black canvas sneakers white background" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine obuće)." },
  { slug: "chino-trousers", title: "Chino Trousers", shots: [
    { name: "white", query: "white chino pants flat lay clothing" },
    { name: "blue", query: "blue chino pants flat lay clothing" },
    { name: "green", query: "olive green chino pants flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "court-sneakers", title: "Court Sneakers", shots: [
    { name: "black", query: "black leather court sneakers white background" },
    { name: "green", query: "green leather sneakers white background" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine obuće)." },
  { slug: "crossbody-bag", title: "Crossbody Bag", shots: [
    { name: "yellow", query: "tan crossbody bag white background" },
    { name: "green", query: "green crossbody bag white background" },
    { name: "white", query: "white crossbody bag white background" },
  ]},
  { slug: "high-waist-jeans", title: "High-Waist Jeans", shots: [
    { name: "white", query: "white high waist jeans flat lay clothing" },
    { name: "blue", query: "blue high waist jeans flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "hooded-sweatshirt", title: "Hooded Sweatshirt", shots: [
    { name: "red", query: "red hoodie flat lay clothing" },
    { name: "blue", query: "blue hoodie flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "kids-graphic-tee", title: "Kids Graphic Tee", shots: [
    { name: "black", query: "black graphic t-shirt flat lay clothing" },
    { name: "blue", query: "blue graphic t-shirt flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "kids-joggers", title: "Kids Joggers", shots: [
    { name: "blue", query: "blue jogger pants flat lay clothing" },
    { name: "black", query: "black jogger pants flat lay clothing" },
    { name: "gray", query: "gray jogger pants flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "knit-sweater", title: "Knit Sweater", shots: [
    { name: "red", query: "red knit sweater flat lay clothing" },
    { name: "white", query: "white knit sweater flat lay clothing" },
    { name: "blue", query: "blue knit sweater flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "silk-blouse", title: "Silk Blouse", shots: [
    { name: "gray", query: "gray silk blouse on hanger product photo" },
    { name: "black", query: "black silk blouse on hanger product photo" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "slim-fit-jeans", title: "Slim Fit Jeans", shots: [
    { name: "green", query: "green jeans flat lay clothing" },
    { name: "blue", query: "blue slim jeans flat lay clothing" },
    { name: "white", query: "white jeans flat lay clothing" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "tote-bag", title: "Tote Bag", shots: [
    { name: "red", query: "red canvas tote bag white background" },
    { name: "gray", query: "gray canvas tote bag white background" },
    { name: "white", query: "white canvas tote bag white background" },
  ]},
  { slug: "trail-hiking-shoes", title: "Trail Hiking Shoes", shots: [
    { name: "green", query: "green hiking shoes white background" },
    { name: "blue", query: "blue hiking shoes white background" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine obuće)." },
  { slug: "trench-coat", title: "Trench Coat", shots: [
    { name: "green", query: "green trench coat on hanger studio photo" },
    { name: "red", query: "red trench coat on hanger studio photo" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },
  { slug: "wool-blazer", title: "Wool Blazer", shots: [
    { name: "gray", query: "gray blazer jacket on hanger product photo" },
    { name: "white", query: "white blazer jacket on hanger product photo" },
  ], note: "Boja se dodeljuje na sve redove te boje (razlicite veličine)." },

  // ── Home & Garden (5) ────────────────────────────────────────────────────
  { slug: "area-rug-160x230", title: "Area Rug 160x230", shots: [
    { name: "gray", query: "gray area rug living room" },
    { name: "yellow", query: "yellow area rug living room" },
  ]},
  { slug: "bookshelf-5-tier", title: "Bookshelf 5-Tier", shots: [
    { name: "white", query: "white tall bookshelf with books" },
  ]},
  { slug: "ceramic-dinnerware-set", title: "Ceramic Dinnerware Set", shots: [
    { name: "blue", query: "blue ceramic dinner plate set" },
    { name: "white", query: "white ceramic dinner plate set" },
  ]},
  { slug: "non-stick-pan-set", title: "Non-Stick Pan Set", shots: [
    { name: "gray", query: "gray non stick frying pan set" },
    { name: "blue", query: "blue non stick frying pan" },
  ]},
  { slug: "woven-wall-art", title: "Woven Wall Art", shots: [
    { name: "hero", query: "handwoven macrame wall hanging natural" },
  ]},

  // ── Sports & Outdoors (3) ────────────────────────────────────────────────
  { slug: "foam-roller", title: "Foam Roller", shots: [
    { name: "yellow", query: "yellow foam roller fitness white background" },
    { name: "black", query: "black foam roller fitness white background" },
  ]},
  { slug: "insulated-water-bottle", title: "Insulated Water Bottle", shots: [
    { name: "black", query: "black insulated water bottle white background" },
    { name: "red", query: "red insulated water bottle white background" },
  ]},
  { slug: "resistance-band-set", title: "Resistance Band Set", shots: [
    { name: "hero", query: "resistance bands fitness set white background" },
  ]},

  // ── Books & Media (2) ────────────────────────────────────────────────────
  { slug: "atomic-habits", title: "Atomic Habits", shots: [
    { name: "hero", query: "self help book cover mockup white background" },
  ]},
  { slug: "clean-architecture", title: "Clean Architecture", shots: [
    { name: "hero", query: "technical book cover mockup white background" },
  ]},

  // ── Health & Beauty (2) ──────────────────────────────────────────────────
  { slug: "fresh-citrus-cologne", title: "Fresh Citrus Cologne", shots: [
    { name: "hero", query: "citrus cologne bottle blank label studio" },
  ], note: "1 slika -> dodeli na oba reda (100ml, 200ml)." },
  { slug: "vitamin-c-cream", title: "Vitamin C Cream", shots: [
    { name: "hero", query: "blank cosmetic jar cream white background" },
  ], note: "1 slika -> dodeli na oba reda (50ml, 100ml)." },

  // ── Toys & Baby (3) ──────────────────────────────────────────────────────
  { slug: "board-game-night", title: "Board Game Night", shots: [
    { name: "hero", query: "board game box with pieces on table" },
  ]},
  { slug: "wooden-train-set", title: "Wooden Train Set", shots: [
    { name: "hero", query: "wooden toy train track set" },
  ]},
  { slug: "soft-activity-cube", title: "Soft Activity Cube", shots: [
    { name: "yellow", query: "yellow baby activity toy soft" },
    { name: "red", query: "red baby sensory toy soft" },
    { name: "white", query: "white plush baby toy soft" },
  ]},
];
