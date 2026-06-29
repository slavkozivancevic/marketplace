import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------- Deterministic RNG (reproducible dataset) ----------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260607);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const pickSome = <T>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
};
const chance = (p: number) => rand() < p;

// ---------- Types ----------

type Locale = "en" | "sr" | "de" | "es";
type LocaleNames = Partial<Record<Locale, string>>;
type SubCategory = { slug: string; order: number; names: LocaleNames };
type Department = {
  slug: string;
  order: number;
  imageUrl?: string;
  names: LocaleNames;
  children: SubCategory[];
};

// ---------- Categories ----------

const departments: Department[] = [
  {
    slug: "electronics",
    order: 1,
    names: { en: "Electronics", sr: "Elektronika" },
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "laptops-computers", order: 1, names: { en: "Laptops & Computers", sr: "Laptopi i računari" } },
      { slug: "smartphones-tablets", order: 2, names: { en: "Smartphones & Tablets", sr: "Pametni telefoni i tableti" } },
      { slug: "tv-audio", order: 3, names: { en: "TV & Audio", sr: "TV i audio" } },
      { slug: "cameras-photography", order: 4, names: { en: "Cameras & Photography", sr: "Kamere i fotografija" } },
      { slug: "gaming", order: 5, names: { en: "Gaming", sr: "Gejming" } },
      { slug: "smart-home", order: 6, names: { en: "Smart Home", sr: "Pametni dom" } },
    ],
  },
  {
    slug: "fashion",
    order: 2,
    names: { en: "Fashion", sr: "Moda" },
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "mens-clothing", order: 1, names: { en: "Men's Clothing", sr: "Muška odeća" } },
      { slug: "womens-clothing", order: 2, names: { en: "Women's Clothing", sr: "Ženska odeća" } },
      { slug: "kids-clothing", order: 3, names: { en: "Kids' Clothing", sr: "Dečija odeća" } },
      { slug: "shoes", order: 4, names: { en: "Shoes", sr: "Obuća" } },
      { slug: "bags-accessories", order: 5, names: { en: "Bags & Accessories", sr: "Torbe i dodaci" } },
      { slug: "jewelry-watches", order: 6, names: { en: "Jewelry & Watches", sr: "Nakit i satovi" } },
    ],
  },
  {
    slug: "home-garden",
    order: 3,
    names: { en: "Home & Garden", sr: "Dom i bašta" },
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "furniture", order: 1, names: { en: "Furniture", sr: "Nameštaj" } },
      { slug: "kitchen-dining", order: 2, names: { en: "Kitchen & Dining", sr: "Kuhinja i trpezarija" } },
      { slug: "bedding-bath", order: 3, names: { en: "Bedding & Bath", sr: "Posteljina i kupatilo" } },
      { slug: "home-decor", order: 4, names: { en: "Home Decor", sr: "Dekoracija doma" } },
      { slug: "garden-outdoor", order: 5, names: { en: "Garden & Outdoor", sr: "Bašta i eksterijer" } },
      { slug: "lighting", order: 6, names: { en: "Lighting", sr: "Rasveta" } },
    ],
  },
  {
    slug: "sports-outdoors",
    order: 4,
    names: { en: "Sports & Outdoors", sr: "Sport i rekreacija" },
    imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "exercise-fitness", order: 1, names: { en: "Exercise & Fitness", sr: "Vežbanje i fitnes" } },
      { slug: "outdoor-recreation", order: 2, names: { en: "Outdoor Recreation", sr: "Rekreacija na otvorenom" } },
      { slug: "team-sports", order: 3, names: { en: "Team Sports", sr: "Ekipni sportovi" } },
      { slug: "cycling", order: 4, names: { en: "Cycling", sr: "Biciklizam" } },
      { slug: "water-sports", order: 5, names: { en: "Water Sports", sr: "Vodeni sportovi" } },
    ],
  },
  {
    slug: "books-media",
    order: 5,
    names: { en: "Books & Media", sr: "Knjige i mediji" },
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "books", order: 1, names: { en: "Books", sr: "Knjige" } },
      { slug: "music", order: 2, names: { en: "Music", sr: "Muzika" } },
      { slug: "movies-tv", order: 3, names: { en: "Movies & TV", sr: "Filmovi i TV" } },
      { slug: "video-games", order: 4, names: { en: "Video Games", sr: "Video igrice" } },
    ],
  },
  {
    slug: "health-beauty",
    order: 6,
    names: { en: "Health & Beauty", sr: "Zdravlje i lepota" },
    imageUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "skincare", order: 1, names: { en: "Skincare", sr: "Nega kože" } },
      { slug: "hair-care", order: 2, names: { en: "Hair Care", sr: "Nega kose" } },
      { slug: "vitamins-supplements", order: 3, names: { en: "Vitamins & Supplements", sr: "Vitamini i suplementi" } },
      { slug: "personal-care", order: 4, names: { en: "Personal Care", sr: "Lična higijena" } },
      { slug: "fragrances", order: 5, names: { en: "Fragrances", sr: "Parfemi" } },
    ],
  },
  {
    slug: "toys-kids",
    order: 7,
    names: { en: "Toys & Kids", sr: "Igračke i deca" },
    imageUrl: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "toys-games", order: 1, names: { en: "Toys & Games", sr: "Igračke i igre" } },
      { slug: "baby-toddler", order: 2, names: { en: "Baby & Toddler", sr: "Bebe i mala deca" } },
      { slug: "educational", order: 3, names: { en: "Educational", sr: "Edukativno" } },
      { slug: "arts-crafts", order: 4, names: { en: "Arts & Crafts", sr: "Umetnost i kreativnost" } },
    ],
  },
  {
    slug: "automotive",
    order: 8,
    names: { en: "Automotive", sr: "Auto-moto" },
    imageUrl: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { slug: "car-electronics", order: 1, names: { en: "Car Electronics", sr: "Auto elektronika" } },
      { slug: "parts-accessories", order: 2, names: { en: "Parts & Accessories", sr: "Delovi i dodaci" } },
      { slug: "tools-equipment", order: 3, names: { en: "Tools & Equipment", sr: "Alati i oprema" } },
      { slug: "car-care-cleaning", order: 4, names: { en: "Care & Cleaning", sr: "Pranje i održavanje" } },
    ],
  },
];

// ---------- Attribute library ----------

type AttrType = "SELECT" | "MULTI_SELECT" | "RANGE" | "BOOLEAN";
type AttrOption = { value: string; order: number; labels: LocaleNames };
type AttrSeed = {
  key: string;
  type: AttrType;
  unit?: string;
  order: number;
  isVariantDefining?: boolean;
  labels: LocaleNames;
  options?: AttrOption[];
};

function uniformOptions(values: string[]): AttrOption[] {
  return values.map((v, i) => ({ value: v.toLowerCase(), order: i, labels: { en: v, sr: v, de: v, es: v } }));
}

const attributes: AttrSeed[] = [
  {
    key: "gender",
    type: "SELECT",
    order: 1,
    labels: { en: "Gender", sr: "Pol", de: "Geschlecht", es: "Género" },
    options: [
      { value: "men", order: 0, labels: { en: "Men", sr: "Muško", de: "Herren", es: "Hombre" } },
      { value: "women", order: 1, labels: { en: "Women", sr: "Žensko", de: "Damen", es: "Mujer" } },
      { value: "boys", order: 2, labels: { en: "Boys", sr: "Dečaci", de: "Jungen", es: "Niños" } },
      { value: "girls", order: 3, labels: { en: "Girls", sr: "Devojčice", de: "Mädchen", es: "Niñas" } },
      { value: "babies", order: 4, labels: { en: "Babies", sr: "Bebe", de: "Babys", es: "Bebés" } },
      { value: "unisex", order: 5, labels: { en: "Unisex", sr: "Uniseks", de: "Unisex", es: "Unisex" } },
    ],
  },
  {
    key: "clothing-size",
    type: "SELECT",
    order: 2,
    isVariantDefining: true,
    labels: { en: "Clothing Size", sr: "Veličina odeće", de: "Kleidergröße", es: "Talla de ropa" },
    options: uniformOptions(["XS", "S", "M", "L", "XL", "XXL"]),
  },
  {
    key: "shoe-size",
    type: "SELECT",
    order: 3,
    isVariantDefining: true,
    labels: { en: "Shoe Size", sr: "Broj obuće", de: "Schuhgröße", es: "Talla de calzado" },
    options: uniformOptions(["38", "39", "40", "41", "42", "43", "44", "45"]),
  },
  {
    key: "condition",
    type: "SELECT",
    order: 4,
    labels: { en: "Condition", sr: "Stanje", de: "Zustand", es: "Estado" },
    options: [
      { value: "new", order: 0, labels: { en: "New", sr: "Novo", de: "Neu", es: "Nuevo" } },
      { value: "used", order: 1, labels: { en: "Used", sr: "Polovno", de: "Gebraucht", es: "Usado" } },
      { value: "refurbished", order: 2, labels: { en: "Refurbished", sr: "Renovirano", de: "Generalüberholt", es: "Reacondicionado" } },
    ],
  },
  {
    key: "color",
    type: "SELECT",
    order: 5,
    isVariantDefining: true,
    labels: { en: "Color", sr: "Boja", de: "Farbe", es: "Color" },
    options: [
      { value: "black", order: 0, labels: { en: "Black", sr: "Crna", de: "Schwarz", es: "Negro" } },
      { value: "white", order: 1, labels: { en: "White", sr: "Bela", de: "Weiß", es: "Blanco" } },
      { value: "red", order: 2, labels: { en: "Red", sr: "Crvena", de: "Rot", es: "Rojo" } },
      { value: "blue", order: 3, labels: { en: "Blue", sr: "Plava", de: "Blau", es: "Azul" } },
      { value: "green", order: 4, labels: { en: "Green", sr: "Zelena", de: "Grün", es: "Verde" } },
      { value: "yellow", order: 5, labels: { en: "Yellow", sr: "Žuta", de: "Gelb", es: "Amarillo" } },
      { value: "gray", order: 6, labels: { en: "Gray", sr: "Siva", de: "Grau", es: "Gris" } },
    ],
  },
  {
    key: "material",
    type: "MULTI_SELECT",
    order: 6,
    labels: { en: "Material", sr: "Materijal", de: "Material", es: "Material" },
    options: [
      { value: "cotton", order: 0, labels: { en: "Cotton", sr: "Pamuk", de: "Baumwolle", es: "Algodón" } },
      { value: "polyester", order: 1, labels: { en: "Polyester", sr: "Poliester", de: "Polyester", es: "Poliéster" } },
      { value: "leather", order: 2, labels: { en: "Leather", sr: "Koža", de: "Leder", es: "Cuero" } },
      { value: "wool", order: 3, labels: { en: "Wool", sr: "Vuna", de: "Wolle", es: "Lana" } },
      { value: "silk", order: 4, labels: { en: "Silk", sr: "Svila", de: "Seide", es: "Seda" } },
      { value: "denim", order: 5, labels: { en: "Denim", sr: "Teksas", de: "Denim", es: "Vaquero" } },
    ],
  },
  { key: "screen-size", type: "RANGE", unit: "inch", order: 7, labels: { en: "Screen Size", sr: "Dijagonala ekrana", de: "Bildschirmgröße", es: "Tamaño de pantalla" } },
  { key: "ram", type: "RANGE", unit: "GB", order: 8, labels: { en: "RAM", sr: "RAM", de: "Arbeitsspeicher", es: "RAM" } },
  { key: "storage", type: "RANGE", unit: "GB", order: 9, labels: { en: "Storage", sr: "Memorija", de: "Speicher", es: "Almacenamiento" } },
  { key: "wireless", type: "BOOLEAN", order: 10, labels: { en: "Wireless", sr: "Bežično", de: "Kabellos", es: "Inalámbrico" } },
  { key: "waterproof", type: "BOOLEAN", order: 11, labels: { en: "Waterproof", sr: "Vodootporno", de: "Wasserdicht", es: "Impermeable" } },
];

const departmentAttributes: Record<string, string[]> = {
  fashion: ["gender", "clothing-size", "shoe-size", "color", "material", "condition"],
  electronics: ["screen-size", "ram", "storage", "wireless", "color", "condition"],
  "home-garden": ["material", "color", "condition"],
  "sports-outdoors": ["gender", "color", "material", "waterproof", "condition"],
  "health-beauty": ["condition"],
  "toys-kids": ["gender", "condition"],
  automotive: ["condition"],
  "books-media": ["condition"],
};

// ---------- Brands ----------

type BrandSeed = { key: string; name: string; kinds: string[] };
const brands: BrandSeed[] = [
  { key: "apple", name: "Apple", kinds: ["electronics"] },
  { key: "samsung", name: "Samsung", kinds: ["electronics"] },
  { key: "sony", name: "Sony", kinds: ["electronics", "gaming"] },
  { key: "dell", name: "Dell", kinds: ["electronics"] },
  { key: "lenovo", name: "Lenovo", kinds: ["electronics"] },
  { key: "lg", name: "LG", kinds: ["electronics", "home"] },
  { key: "canon", name: "Canon", kinds: ["electronics"] },
  { key: "nike", name: "Nike", kinds: ["fashion", "sports"] },
  { key: "adidas", name: "Adidas", kinds: ["fashion", "sports"] },
  { key: "zara", name: "Zara", kinds: ["fashion"] },
  { key: "hm", name: "H&M", kinds: ["fashion"] },
  { key: "levis", name: "Levi's", kinds: ["fashion"] },
  { key: "ikea", name: "IKEA", kinds: ["home"] },
  { key: "bosch", name: "Bosch", kinds: ["home", "automotive"] },
  { key: "lego", name: "LEGO", kinds: ["toys"] },
];

// ---------- Tags ----------

const tags = [
  "new", "popular", "bestseller", "discount", "premium", "limited", "eco-friendly",
  "trending", "clearance", "top-rated", "handmade", "imported", "exclusive", "gift-idea",
  "budget", "luxury", "staff-pick", "back-in-stock", "seasonal", "online-only",
];

// ---------- Organizations + Users ----------

const orgSeeds = [
  { name: "Demo Store", verified: true },
  { name: "Tech Haven", verified: true },
  { name: "Fashion Forward", verified: false },
];

type UserSeed = { name: string; email: string; role: "USER" | "ADMIN" | "SELLER"; orgIndex?: number };
const userSeeds: UserSeed[] = [
  { name: "Admin Root", email: "admin@marketplace.test", role: "ADMIN", orgIndex: 0 },
  { name: "Marko Petrović", email: "marko.seller@marketplace.test", role: "SELLER", orgIndex: 0 },
  { name: "Ivana Jovanović", email: "ivana.seller@marketplace.test", role: "SELLER", orgIndex: 1 },
  { name: "Stefan Nikolić", email: "stefan.seller@marketplace.test", role: "SELLER", orgIndex: 2 },
  { name: "Ana Marković", email: "ana@marketplace.test", role: "USER" },
  { name: "Nikola Đorđević", email: "nikola@marketplace.test", role: "USER" },
  { name: "Jelena Stojanović", email: "jelena@marketplace.test", role: "USER" },
  { name: "Miloš Ilić", email: "milos@marketplace.test", role: "USER" },
  { name: "Sara Pavlović", email: "sara@marketplace.test", role: "USER" },
  { name: "Luka Ristić", email: "luka@marketplace.test", role: "USER" },
];

// ---------- Product name pools per subcategory ----------
// kind drives attribute/variant profile.

type ProductKind = "apparel" | "shoes" | "electronics" | "generic";
type ProductSpec = {
  sub: string;
  kind: ProductKind;
  brandKinds: string[];
  priceMin: number; // cents
  priceMax: number;
  images: string[];
  names: { en: string; sr: string }[];
};

const IMG = {
  laptop: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80&auto=format&fit=crop"],
  phone: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80&auto=format&fit=crop"],
  tv: ["https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80&auto=format&fit=crop"],
  camera: ["https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80&auto=format&fit=crop"],
  headphones: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&auto=format&fit=crop"],
  tshirt: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80&auto=format&fit=crop"],
  jacket: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80&auto=format&fit=crop"],
  shoes: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&auto=format&fit=crop"],
  bag: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80&auto=format&fit=crop"],
  furniture: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80&auto=format&fit=crop"],
  kitchen: ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80&auto=format&fit=crop"],
  sports: ["https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80&auto=format&fit=crop"],
  book: ["https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80&auto=format&fit=crop"],
  beauty: ["https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80&auto=format&fit=crop"],
  toy: ["https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&q=80&auto=format&fit=crop"],
  car: ["https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80&auto=format&fit=crop"],
};

const productSpecs: ProductSpec[] = [
  { sub: "laptops-computers", kind: "electronics", brandKinds: ["electronics"], priceMin: 49900, priceMax: 249900, images: IMG.laptop,
    names: [
      { en: "UltraBook Pro 14", sr: "UltraBook Pro 14" }, { en: "Office Laptop 15", sr: "Kancelarijski laptop 15" },
      { en: "Gaming Notebook X", sr: "Gejming laptop X" }, { en: "Student Chromebook", sr: "Studentski Chromebook" },
      { en: "Workstation Tower", sr: "Radna stanica" }, { en: "Convertible 2-in-1", sr: "Konvertibilni 2-u-1" } ] },
  { sub: "smartphones-tablets", kind: "electronics", brandKinds: ["electronics"], priceMin: 19900, priceMax: 159900, images: IMG.phone,
    names: [
      { en: "Galaxy Phone S", sr: "Galaxy telefon S" }, { en: "Pro Max Smartphone", sr: "Pro Max pametni telefon" },
      { en: "Budget Phone Lite", sr: "Budžet telefon Lite" }, { en: "Tablet Air 11", sr: "Tablet Air 11" },
      { en: "Mini Tablet 8", sr: "Mini tablet 8" }, { en: "Foldable Phone Z", sr: "Preklopni telefon Z" } ] },
  { sub: "tv-audio", kind: "electronics", brandKinds: ["electronics"], priceMin: 9900, priceMax: 199900, images: IMG.tv,
    names: [
      { en: "4K Smart TV 55", sr: "4K Smart TV 55" }, { en: "OLED TV 65", sr: "OLED TV 65" },
      { en: "Soundbar 2.1", sr: "Soundbar 2.1" }, { en: "Bluetooth Speaker", sr: "Bluetooth zvučnik" } ] },
  { sub: "tv-audio", kind: "electronics", brandKinds: ["electronics"], priceMin: 4900, priceMax: 49900, images: IMG.headphones,
    names: [
      { en: "Wireless Headphones", sr: "Bežične slušalice" }, { en: "Noise-Cancel Earbuds", sr: "Bubice sa redukcijom buke" },
      { en: "Studio Over-Ear", sr: "Studijske slušalice" } ] },
  { sub: "cameras-photography", kind: "electronics", brandKinds: ["electronics"], priceMin: 29900, priceMax: 299900, images: IMG.camera,
    names: [
      { en: "Mirrorless Camera", sr: "Mirrorless kamera" }, { en: "DSLR Kit", sr: "DSLR komplet" },
      { en: "Action Camera 4K", sr: "Akciona kamera 4K" }, { en: "Vlogging Camera", sr: "Vlog kamera" } ] },
  { sub: "gaming", kind: "electronics", brandKinds: ["gaming", "electronics"], priceMin: 4900, priceMax: 79900, images: IMG.headphones,
    names: [
      { en: "Game Console X", sr: "Konzola X" }, { en: "Wireless Controller", sr: "Bežični kontroler" },
      { en: "Gaming Headset", sr: "Gejming slušalice" }, { en: "Mechanical Keyboard", sr: "Mehanička tastatura" } ] },
  // Fashion - apparel
  { sub: "mens-clothing", kind: "apparel", brandKinds: ["fashion"], priceMin: 1499, priceMax: 12900, images: IMG.tshirt,
    names: [
      { en: "Classic Cotton T-Shirt", sr: "Klasična pamučna majica" }, { en: "Oxford Shirt", sr: "Oxford košulja" },
      { en: "Slim Fit Jeans", sr: "Farmerke slim kroja" }, { en: "Hooded Sweatshirt", sr: "Duks sa kapuljačom" },
      { en: "Wool Blazer", sr: "Vuneni sako" }, { en: "Chino Trousers", sr: "Chino pantalone" } ] },
  { sub: "womens-clothing", kind: "apparel", brandKinds: ["fashion"], priceMin: 1499, priceMax: 14900, images: IMG.jacket,
    names: [
      { en: "Summer Dress", sr: "Letnja haljina" }, { en: "Knit Sweater", sr: "Pleteni džemper" },
      { en: "High-Waist Jeans", sr: "Farmerke visokog struka" }, { en: "Silk Blouse", sr: "Svilena bluza" },
      { en: "Trench Coat", sr: "Trenčkot" }, { en: "Yoga Leggings", sr: "Helanke za jogu" } ] },
  { sub: "kids-clothing", kind: "apparel", brandKinds: ["fashion"], priceMin: 999, priceMax: 5900, images: IMG.tshirt,
    names: [
      { en: "Kids Graphic Tee", sr: "Dečija majica sa štampom" }, { en: "Kids Hoodie", sr: "Dečiji duks" },
      { en: "Kids Joggers", sr: "Dečije trenerke" } ] },
  { sub: "shoes", kind: "shoes", brandKinds: ["fashion", "sports"], priceMin: 3900, priceMax: 19900, images: IMG.shoes,
    names: [
      { en: "Running Sneakers", sr: "Patike za trčanje" }, { en: "Leather Boots", sr: "Kožne čizme" },
      { en: "Canvas Low-Tops", sr: "Platnene patike" }, { en: "Trail Hiking Shoes", sr: "Cipele za planinarenje" },
      { en: "Court Sneakers", sr: "Klasične patike" } ] },
  { sub: "bags-accessories", kind: "generic", brandKinds: ["fashion"], priceMin: 1999, priceMax: 29900, images: IMG.bag,
    names: [
      { en: "Leather Backpack", sr: "Kožni ranac" }, { en: "Tote Bag", sr: "Tote torba" },
      { en: "Crossbody Bag", sr: "Crossbody torba" }, { en: "Leather Wallet", sr: "Kožni novčanik" } ] },
  // Home
  { sub: "furniture", kind: "generic", brandKinds: ["home"], priceMin: 4900, priceMax: 99900, images: IMG.furniture,
    names: [
      { en: "Oak Coffee Table", sr: "Hrastov sto za dnevnu sobu" }, { en: "Fabric Sofa 3-Seat", sr: "Trosed od tkanine" },
      { en: "Ergonomic Office Chair", sr: "Ergonomska kancelarijska stolica" }, { en: "Bookshelf 5-Tier", sr: "Polica za knjige 5 nivoa" } ] },
  { sub: "kitchen-dining", kind: "generic", brandKinds: ["home"], priceMin: 1499, priceMax: 39900, images: IMG.kitchen,
    names: [
      { en: "Non-Stick Pan Set", sr: "Set tiganja sa neprijanjajućim slojem" }, { en: "Stainless Knife Block", sr: "Blok noževa od nerđajućeg čelika" },
      { en: "Espresso Machine", sr: "Espreso aparat" }, { en: "Ceramic Dinnerware Set", sr: "Keramički set posuđa" } ] },
  { sub: "home-decor", kind: "generic", brandKinds: ["home"], priceMin: 999, priceMax: 14900, images: IMG.furniture,
    names: [
      { en: "Woven Wall Art", sr: "Tkani zidni ukras" }, { en: "Scented Candle Set", sr: "Set mirisnih sveća" },
      { en: "Area Rug 160x230", sr: "Tepih 160x230" } ] },
  // Sports
  { sub: "exercise-fitness", kind: "generic", brandKinds: ["sports"], priceMin: 1499, priceMax: 49900, images: IMG.sports,
    names: [
      { en: "Adjustable Dumbbells", sr: "Podesivi bučice" }, { en: "Yoga Mat Pro", sr: "Prostirka za jogu Pro" },
      { en: "Resistance Band Set", sr: "Set elastičnih traka" }, { en: "Foam Roller", sr: "Foam roler" } ] },
  { sub: "outdoor-recreation", kind: "generic", brandKinds: ["sports"], priceMin: 2900, priceMax: 39900, images: IMG.sports,
    names: [
      { en: "2-Person Tent", sr: "Šator za 2 osobe" }, { en: "Insulated Water Bottle", sr: "Termo flaša" },
      { en: "Hiking Backpack 40L", sr: "Planinarski ranac 40L" } ] },
  { sub: "cycling", kind: "generic", brandKinds: ["sports"], priceMin: 1999, priceMax: 149900, images: IMG.sports,
    names: [
      { en: "Mountain Bike 29", sr: "Brdski bicikl 29" }, { en: "Cycling Helmet", sr: "Biciklistička kaciga" } ] },
  // Books & media
  { sub: "books", kind: "generic", brandKinds: [], priceMin: 799, priceMax: 4900, images: IMG.book,
    names: [
      { en: "The Pragmatic Developer", sr: "Pragmatični programer" }, { en: "Atomic Habits", sr: "Atomske navike" },
      { en: "Clean Architecture", sr: "Čista arhitektura" }, { en: "Cooking Basics", sr: "Osnove kuvanja" } ] },
  { sub: "video-games", kind: "generic", brandKinds: ["gaming"], priceMin: 1999, priceMax: 7900, images: IMG.toy,
    names: [
      { en: "Open World RPG", sr: "Open world RPG" }, { en: "Racing Sim 2026", sr: "Trkačka simulacija 2026" } ] },
  // Health & beauty
  { sub: "skincare", kind: "generic", brandKinds: [], priceMin: 699, priceMax: 8900, images: IMG.beauty,
    names: [
      { en: "Hydrating Serum", sr: "Hidratantni serum" }, { en: "Vitamin C Cream", sr: "Krema sa vitaminom C" },
      { en: "SPF 50 Sunscreen", sr: "SPF 50 zaštita od sunca" } ] },
  { sub: "fragrances", kind: "generic", brandKinds: [], priceMin: 2900, priceMax: 19900, images: IMG.beauty,
    names: [
      { en: "Eau de Parfum Noir", sr: "Eau de Parfum Noir" }, { en: "Fresh Citrus Cologne", sr: "Sveža citrus kolonjska" } ] },
  // Toys
  { sub: "toys-games", kind: "generic", brandKinds: ["toys"], priceMin: 999, priceMax: 14900, images: IMG.toy,
    names: [
      { en: "Building Bricks 1000pc", sr: "Kocke 1000 delova" }, { en: "Wooden Train Set", sr: "Drveni voz set" },
      { en: "Board Game Night", sr: "Društvena igra" }, { en: "Remote Control Car", sr: "Auto na daljinski" } ] },
  { sub: "baby-toddler", kind: "generic", brandKinds: ["toys"], priceMin: 1499, priceMax: 29900, images: IMG.toy,
    names: [
      { en: "Soft Activity Cube", sr: "Mekana kocka za aktivnosti" }, { en: "Stroller Lite", sr: "Kolica Lite" } ] },
  // Automotive
  { sub: "car-electronics", kind: "electronics", brandKinds: ["automotive", "electronics"], priceMin: 2900, priceMax: 39900, images: IMG.car,
    names: [
      { en: "Dash Cam 1080p", sr: "Dash kamera 1080p" }, { en: "Car Bluetooth Adapter", sr: "Auto Bluetooth adapter" } ] },
  { sub: "tools-equipment", kind: "generic", brandKinds: ["automotive", "home"], priceMin: 1999, priceMax: 49900, images: IMG.car,
    names: [
      { en: "Cordless Drill 18V", sr: "Akumulatorska bušilica 18V" }, { en: "Socket Wrench Set", sr: "Set nasadnih ključeva" } ] },
];

// ---------- Helpers ----------

function toLabelRows(labels: LocaleNames) {
  return Object.entries(labels).map(([locale, label]) => ({ locale, label: label! }));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findCategoryByEnSlug(slug: string) {
  const trans = await prisma.categoryTranslation.findUnique({
    where: { locale_slug: { locale: "en", slug } },
    select: { categoryId: true },
  });
  if (!trans) return null;
  return prisma.category.findUnique({ where: { id: trans.categoryId } });
}

function buildCatTranslationRows(names: LocaleNames, slug: string) {
  return Object.entries(names).map(([locale, name]) => ({ locale, name: name!, slug, description: null }));
}

// ---------- Seeders ----------

async function seedCategories() {
  console.log("🌱 Categories...");
  for (const dept of departments) {
    let parent = await findCategoryByEnSlug(dept.slug);
    const rows = buildCatTranslationRows(dept.names, dept.slug);
    if (parent) {
      parent = await prisma.category.update({
        where: { id: parent.id },
        data: { order: dept.order, isActive: true, isFeatured: true, imageUrl: dept.imageUrl ?? null, translations: { deleteMany: {}, create: rows } },
      });
    } else {
      parent = await prisma.category.create({
        data: { order: dept.order, isActive: true, isFeatured: true, parentId: null, imageUrl: dept.imageUrl ?? null, translations: { create: rows } },
      });
    }
    for (const sub of dept.children) {
      const child = await findCategoryByEnSlug(sub.slug);
      const subRows = buildCatTranslationRows(sub.names, sub.slug);
      if (child) {
        await prisma.category.update({ where: { id: child.id }, data: { order: sub.order, isActive: true, parentId: parent.id, translations: { deleteMany: {}, create: subRows } } });
      } else {
        await prisma.category.create({ data: { order: sub.order, isActive: true, isFeatured: false, parentId: parent.id, translations: { create: subRows } } });
      }
    }
  }
  console.log(`  ✓ ${departments.length} departments + subcategories`);
}

async function seedAttributes() {
  console.log("🏷️  Attributes...");
  for (const a of attributes) {
    const labelRows = toLabelRows(a.labels);
    const attribute = await prisma.attribute.upsert({
      where: { key: a.key },
      update: { type: a.type, unit: a.unit ?? null, order: a.order, isVariantDefining: a.isVariantDefining ?? false, translations: { deleteMany: {}, create: labelRows } },
      create: { key: a.key, type: a.type, unit: a.unit ?? null, order: a.order, isVariantDefining: a.isVariantDefining ?? false, translations: { create: labelRows } },
    });
    for (const opt of a.options ?? []) {
      await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value: opt.value } },
        update: { order: opt.order, translations: { deleteMany: {}, create: toLabelRows(opt.labels) } },
        create: { attributeId: attribute.id, value: opt.value, order: opt.order, translations: { create: toLabelRows(opt.labels) } },
      });
    }
  }
  console.log(`  ✓ ${attributes.length} attributes`);
}

async function seedCategoryAttributes() {
  console.log("🔗 Category attributes...");
  for (const [deptSlug, keys] of Object.entries(departmentAttributes)) {
    const dept = await findCategoryByEnSlug(deptSlug);
    if (!dept) continue;
    for (const [index, key] of keys.entries()) {
      const attribute = await prisma.attribute.findUnique({ where: { key } });
      if (!attribute) continue;
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: dept.id, attributeId: attribute.id } },
        update: { order: index, isFilterable: true },
        create: { categoryId: dept.id, attributeId: attribute.id, order: index, isFilterable: true },
      });
    }
  }
  console.log(`  ✓ assigned to ${Object.keys(departmentAttributes).length} departments`);
}

async function seedBrands(): Promise<Map<string, string>> {
  console.log("™️  Brands...");
  const map = new Map<string, string>();
  for (const b of brands) {
    const existing = await prisma.brandTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: b.key } },
      select: { brandId: true },
    });
    if (existing) { map.set(b.key, existing.brandId); continue; }
    const brand = await prisma.brand.create({
      data: {
        translations: {
          create: [
            { locale: "en", name: b.name, slug: b.key },
            { locale: "sr", name: b.name, slug: `${b.key}-sr` },
          ],
        },
      },
    });
    map.set(b.key, brand.id);
  }
  console.log(`  ✓ ${brands.length} brands`);
  return map;
}

async function seedOrgsAndUsers(): Promise<{ orgIds: string[]; userIds: string[]; buyerIds: string[] }> {
  console.log("👥 Organizations + users...");
  const orgIds: string[] = [];
  for (const o of orgSeeds) {
    let org = await prisma.organization.findFirst({ where: { name: o.name } });
    if (!org) org = await prisma.organization.create({ data: { name: o.name, verified: o.verified } });
    orgIds.push(org.id);
  }

  const userIds: string[] = [];
  const buyerIds: string[] = [];
  for (const [i, u] of userSeeds.entries()) {
    const orgId = u.orgIndex != null ? orgIds[u.orgIndex] : undefined;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, activeOrgId: orgId ?? null },
      create: { clerkUserId: `seed_user_${i}`, email: u.email, name: u.name, role: u.role, activeOrgId: orgId ?? null, locale: "en" },
    });
    userIds.push(user.id);
    if (u.role === "USER") buyerIds.push(user.id);
    if (orgId) {
      await prisma.membership.upsert({
        where: { userId_orgId: { userId: user.id, orgId } },
        update: { role: u.role === "SELLER" ? "OWNER" : "ADMIN" },
        create: { userId: user.id, orgId, role: u.role === "SELLER" ? "OWNER" : "ADMIN" },
      });
    }
  }
  console.log(`  ✓ ${orgIds.length} orgs, ${userIds.length} users`);
  return { orgIds, userIds, buyerIds };
}

async function seedTags(): Promise<{ id: string; slug: string }[]> {
  console.log("🔖 Tags...");
  const out: { id: string; slug: string }[] = [];
  for (const name of tags) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    out.push({ id: tag.id, slug });
  }
  console.log(`  ✓ ${tags.length} tags`);
  return out;
}

type SeededProduct = { id: string; price: number; variantIds: string[] };

async function seedProducts(
  orgIds: string[],
  brandMap: Map<string, string>,
  tagList: { id: string; slug: string }[],
): Promise<SeededProduct[]> {
  console.log("📦 Products...");

  // Resolve attribute + option ids once.
  const attrRows = await prisma.attribute.findMany({
    select: { id: true, key: true, options: { select: { id: true, value: true } } },
  });
  const attrByKey = new Map(
    attrRows.map((a) => [a.key, { id: a.id, opt: new Map(a.options.map((o) => [o.value, o.id])) }]),
  );
  const optId = (key: string, value: string) => attrByKey.get(key)?.opt.get(value);

  // Category id per subcategory slug.
  const subCatId = new Map<string, string>();
  for (const dept of departments) {
    for (const sub of dept.children) {
      const c = await findCategoryByEnSlug(sub.slug);
      if (c) subCatId.set(sub.slug, c.id);
    }
  }

  const brandKeysByKind = (kinds: string[]) =>
    brands.filter((b) => kinds.length === 0 || b.kinds.some((k) => kinds.includes(k))).map((b) => b.key);

  const colorValues = ["black", "white", "red", "blue", "green", "gray"];
  const created: SeededProduct[] = [];
  let total = 0;

  for (const spec of productSpecs) {
    const categoryId = subCatId.get(spec.sub);
    if (!categoryId) continue;
    const eligibleBrands = brandKeysByKind(spec.brandKinds);

    for (const nm of spec.names) {
      const baseSlug = slugify(nm.en);
      // Skip if already seeded (idempotent-ish).
      const exists = await prisma.productTranslation.findUnique({
        where: { locale_slug: { locale: "en", slug: baseSlug } },
        select: { productId: true },
      });
      if (exists) {
        const v = await prisma.productVariant.findMany({ where: { productId: exists.productId }, select: { id: true } });
        const p = await prisma.product.findUnique({ where: { id: exists.productId }, select: { price: true } });
        // Backfill variant <-> media links for products seeded before this step.
        if (v.length > 0) {
          const media = await prisma.productMedia.findMany({
            where: { productId: exists.productId },
            select: { id: true, order: true },
            orderBy: { order: "asc" },
          });
          const primaryMedia = media[0];
          if (primaryMedia) {
            await prisma.productVariantMedia.createMany({
              data: v.map((x) => ({ variantId: x.id, mediaId: primaryMedia.id, order: 0 })),
              skipDuplicates: true,
            });
          }
        }
        created.push({ id: exists.productId, price: p?.price ?? spec.priceMin, variantIds: v.map((x) => x.id) });
        continue;
      }

      const price = randInt(spec.priceMin, spec.priceMax);
      const onSale = chance(0.3);
      const compareAtPrice = onSale ? Math.round(price * (1 + randInt(15, 40) / 100)) : null;
      const orgId = pick(orgIds);
      const brandId = eligibleBrands.length ? brandMap.get(pick(eligibleBrands)) : undefined;

      // Attribute values (non-variant) + variant axes per kind.
      const productAttrValues: { attributeId: string; optionId?: string; valueNumeric?: number; valueBool?: boolean }[] = [];
      const pushOpt = (key: string, value: string) => {
        const a = attrByKey.get(key); const o = optId(key, value);
        if (a && o) productAttrValues.push({ attributeId: a.id, optionId: o });
      };
      const pushNum = (key: string, n: number) => { const a = attrByKey.get(key); if (a) productAttrValues.push({ attributeId: a.id, valueNumeric: n }); };
      const pushBool = (key: string, b: boolean) => { const a = attrByKey.get(key); if (a) productAttrValues.push({ attributeId: a.id, valueBool: b }); };

      pushOpt("condition", chance(0.85) ? "new" : pick(["used", "refurbished"]));

      let variantAxes: { attributeId: string; optionId: string }[][] = [];

      if (spec.kind === "apparel" || spec.kind === "shoes") {
        pushOpt("gender", pick(spec.sub.startsWith("womens") ? ["women"] : spec.sub.startsWith("mens") ? ["men"] : spec.sub.startsWith("kids") ? ["boys", "girls"] : ["men", "women", "unisex"]));
        for (const m of pickSome(["cotton", "polyester", "leather", "wool", "denim"], randInt(1, 2))) pushOpt("material", m);
        const colorAttr = attrByKey.get("color")!;
        const sizeKey = spec.kind === "shoes" ? "shoe-size" : "clothing-size";
        const sizeAttr = attrByKey.get(sizeKey)!;
        const chosenColors = pickSome(colorValues, randInt(2, 3));
        const sizes = spec.kind === "shoes" ? ["40", "41", "42", "43"] : ["s", "m", "l", "xl"];
        const chosenSizes = pickSome(sizes, randInt(2, 4));
        variantAxes = chosenColors.flatMap((c) =>
          chosenSizes.map((s) => [
            { attributeId: colorAttr.id, optionId: optId("color", c)! },
            { attributeId: sizeAttr.id, optionId: optId(sizeKey, s)! },
          ]),
        );
      } else if (spec.kind === "electronics") {
        if (["laptops-computers", "smartphones-tablets", "tv-audio", "cameras-photography"].includes(spec.sub)) {
          if (spec.sub !== "tv-audio") pushNum("screen-size", pick([13, 14, 15, 6, 6.5, 11]));
          else pushNum("screen-size", pick([32, 43, 55, 65]));
          pushNum("ram", pick([8, 16, 32]));
          pushNum("storage", pick([128, 256, 512, 1024]));
        }
        pushBool("wireless", chance(0.7));
        // Color variants only (single axis) for some electronics.
        if (chance(0.6)) {
          const colorAttr = attrByKey.get("color")!;
          variantAxes = pickSome(colorValues, randInt(2, 3)).map((c) => [
            { attributeId: colorAttr.id, optionId: optId("color", c)! },
          ]);
        }
      } else {
        // generic
        if (attrByKey.has("material") && chance(0.5)) pushOpt("material", pick(["cotton", "leather", "wool", "polyester"]));
        if (chance(0.3)) pushBool("waterproof", true);
      }

      const translations = [
        { locale: "en", title: nm.en, slug: baseSlug, description: `${nm.en} - quality product from our ${spec.sub.replace(/-/g, " ")} selection.`, searchText: nm.en },
        { locale: "sr", title: nm.sr, slug: `${baseSlug}-sr`, description: `${nm.sr} - kvalitetan proizvod iz naše ponude.`, searchText: nm.sr },
      ];

      const media = spec.images.map((url, i) => ({
        url, key: `seed/${baseSlug}/${i}`, thumbUrl: url, thumbKey: `seed/${baseSlug}/${i}-thumb`, mediaType: "IMAGE" as const, order: i,
      }));

      const variants = variantAxes.map((axes, i) => ({
        sku: `${baseSlug}-${i + 1}`.toUpperCase(),
        price: onSale ? price : price,
        compareAtPrice,
        stock: randInt(0, 60),
        order: i,
        attributeValues: { create: axes.map((a) => ({ attributeId: a.attributeId, optionId: a.optionId })) },
      }));

      const chosenTags = pickSome(tagList, randInt(1, 3));

      const product = await prisma.product.create({
        data: {
          price,
          compareAtPrice,
          stock: variants.length === 0 ? randInt(0, 100) : null,
          status: "PUBLISHED",
          publishedAt: new Date(Date.now() - randInt(0, 120) * 86400000),
          featuredAt: chance(0.15) ? new Date() : null,
          organizationId: orgId,
          brandId,
          translations: { create: translations },
          categories: { create: [{ categoryId }] },
          attributeValues: { create: productAttrValues },
          variants: { create: variants },
          media: { create: media },
          tags: { create: chosenTags.map((tg) => ({ tagId: tg.id })) },
        },
        select: {
          id: true,
          price: true,
          variants: { select: { id: true } },
          media: { select: { id: true, order: true } },
        },
      });

      // Link the product's primary image to every variant so the variant
      // gallery has an associated asset. (Seed specs carry a single image per
      // product, so all variants share it; per-color art would need more URLs.)
      const primaryMedia = product.media.find((m) => m.order === 0) ?? product.media[0];
      if (primaryMedia && product.variants.length > 0) {
        await prisma.productVariantMedia.createMany({
          data: product.variants.map((v) => ({ variantId: v.id, mediaId: primaryMedia.id, order: 0 })),
        });
      }

      created.push({ id: product.id, price: product.price, variantIds: product.variants.map((v) => v.id) });
      total++;
    }
  }
  console.log(`  ✓ ${total} products created (${created.length} total in catalog)`);
  return created;
}

async function seedTransactions(buyerIds: string[], products: SeededProduct[]) {
  console.log("🧾 Orders, reviews, wishlists...");
  if (buyerIds.length === 0 || products.length === 0) return;

  // Rating distribution helper.
  const rollRating = () => {
    const r = rand();
    if (r < 0.6) return 5;
    if (r < 0.85) return 4;
    if (r < 0.95) return 3;
    return randInt(1, 2);
  };
  const comments = [
    "Exactly as described, very happy with it.", "Great quality for the price.",
    "Fast shipping, product works perfectly.", "Decent, but packaging could be better.",
    "Would buy again. Recommended.", "Looks even better in person.",
    "Solid value. No complaints.", "Met my expectations.",
  ];

  const orderCount = 42;
  // Track (productId,userId) reviews to respect unique constraint.
  const reviewedPairs = new Set<string>();
  let reviewTotal = 0;
  const ratingAgg = new Map<string, { sum: number; count: number }>();

  for (let i = 0; i < orderCount; i++) {
    const userId = pick(buyerIds);
    const itemCount = randInt(1, 3);
    const chosen = pickSome(products, itemCount);
    if (chosen.length === 0) continue;

    const items = chosen.map((p) => {
      const variantId = p.variantIds.length ? pick(p.variantIds) : null;
      const quantity = randInt(1, 2);
      return { productId: p.id, variantId, quantity, price: p.price };
    });
    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

    const status = chance(0.8) ? "COMPLETED" : pick(["PENDING", "CANCELLED"] as const);
    const paymentMethod = chance(0.7) ? "STRIPE" : "COD";

    const order = await prisma.order.create({
      data: {
        userId,
        status,
        total,
        paymentMethod,
        locale: "en",
        currency: "usd",
        createdAt: new Date(Date.now() - randInt(0, 90) * 86400000),
        shippingName: "Seed Buyer",
        shippingLine1: "123 Demo Street",
        shippingCity: "Belgrade",
        shippingPostalCode: "11000",
        shippingCountry: "RS",
        items: { create: items.map((it) => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity, price: it.price })) },
      },
      select: { id: true },
    });

    // Ledger backfill: every order gets a CHARGE row matching the runtime flow.
    // Stripe charges are captured up front (SUCCEEDED); COD cash is collected on
    // delivery, so it is SUCCEEDED only once the order is COMPLETED, else PENDING.
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        type: "CHARGE",
        status: paymentMethod === "STRIPE" || status === "COMPLETED" ? "SUCCEEDED" : "PENDING",
        provider: paymentMethod,
        providerId: paymentMethod === "STRIPE" ? `seed_pi_${order.id}` : null,
        amount: total,
        currency: "usd",
      },
    });

    // Reviews from completed orders (~70% of items), respecting uniqueness.
    if (status === "COMPLETED") {
      for (const it of items) {
        const pairKey = `${it.productId}:${userId}`;
        if (reviewedPairs.has(pairKey)) continue;
        if (!chance(0.7)) continue;
        reviewedPairs.add(pairKey);
        const rating = rollRating();
        // Upsert so a re-seed against an existing DB does not collide with
        // reviews left by a previous run (unique on productId + userId).
        await prisma.productReview.upsert({
          where: { productId_userId: { productId: it.productId, userId } },
          // Seeded reviews are pre-approved so they show publicly and match the
          // aggregate below (moderation only gates real, user-submitted reviews).
          update: { rating, comment: chance(0.7) ? pick(comments) : null, status: "APPROVED" },
          create: {
            productId: it.productId,
            userId,
            orderId: order.id,
            rating,
            comment: chance(0.7) ? pick(comments) : null,
            status: "APPROVED",
          },
        });
        const agg = ratingAgg.get(it.productId) ?? { sum: 0, count: 0 };
        agg.sum += rating; agg.count += 1;
        ratingAgg.set(it.productId, agg);
        reviewTotal++;
      }
    }
  }

  // Persist aggregate rating onto products.
  for (const [productId, agg] of ratingAgg) {
    await prisma.product.update({
      where: { id: productId },
      data: { avgRating: agg.sum / agg.count, ratingCount: agg.count },
    });
  }

  // Wishlists - popular products (first third) get more entries.
  const popular = products.slice(0, Math.ceil(products.length / 3));
  const wishlistPairs = new Set<string>();
  let wishlistTotal = 0;
  for (const userId of buyerIds) {
    const picks = pickSome(rand() < 0.5 ? popular : products, randInt(2, 6));
    for (const p of picks) {
      const key = `${userId}:${p.id}`;
      if (wishlistPairs.has(key)) continue;
      wishlistPairs.add(key);
      await prisma.wishlist.upsert({
        where: { userId_productId: { userId, productId: p.id } },
        update: {},
        create: { userId, productId: p.id },
      });
      wishlistTotal++;
    }
  }

  console.log(`  ✓ ${orderCount} orders, ${reviewTotal} reviews, ${wishlistTotal} wishlist entries`);
}

// ---------- Orchestrator ----------

async function seed() {
  console.log("\n🌱 Seeding marketplace dataset...\n");
  await seedCategories();
  await seedAttributes();
  await seedCategoryAttributes();
  const brandMap = await seedBrands();
  const { orgIds, buyerIds } = await seedOrgsAndUsers();
  const tagList = await seedTags();
  const products = await seedProducts(orgIds, brandMap, tagList);
  await seedTransactions(buyerIds, products);
  console.log("\n✅ Seed complete.\n");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
