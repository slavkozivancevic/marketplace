import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------- Data ----------

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

const departments: Department[] = [
  {
    slug: "electronics",
    order: 1,
    names: { en: "Electronics", sr: "Elektronika" },
    imageUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&q=80&auto=format&fit=crop",
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
  labels: LocaleNames;
  options?: AttrOption[];
};

/** Builds size options whose label is identical across locales (XS, 42, ...). */
function uniformOptions(values: string[]): AttrOption[] {
  return values.map((v, i) => ({
    value: v.toLowerCase(),
    order: i,
    labels: { en: v, sr: v, de: v, es: v },
  }));
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
    labels: { en: "Clothing Size", sr: "Veličina odeće", de: "Kleidergröße", es: "Talla de ropa" },
    options: uniformOptions(["XS", "S", "M", "L", "XL", "XXL"]),
  },
  {
    key: "shoe-size",
    type: "SELECT",
    order: 3,
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
    type: "MULTI_SELECT",
    order: 5,
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
  {
    key: "screen-size",
    type: "RANGE",
    unit: "inch",
    order: 7,
    labels: { en: "Screen Size", sr: "Dijagonala ekrana", de: "Bildschirmgröße", es: "Tamaño de pantalla" },
  },
  {
    key: "ram",
    type: "RANGE",
    unit: "GB",
    order: 8,
    labels: { en: "RAM", sr: "RAM", de: "Arbeitsspeicher", es: "RAM" },
  },
  {
    key: "storage",
    type: "RANGE",
    unit: "GB",
    order: 9,
    labels: { en: "Storage", sr: "Memorija", de: "Speicher", es: "Almacenamiento" },
  },
  {
    key: "wireless",
    type: "BOOLEAN",
    order: 10,
    labels: { en: "Wireless", sr: "Bežično", de: "Kabellos", es: "Inalámbrico" },
  },
  {
    key: "waterproof",
    type: "BOOLEAN",
    order: 11,
    labels: { en: "Waterproof", sr: "Vodootporno", de: "Wasserdicht", es: "Impermeable" },
  },
];

function toLabelRows(labels: LocaleNames) {
  return Object.entries(labels).map(([locale, label]) => ({ locale, label: label! }));
}

// Which attribute keys each department exposes as filters. Subcategories inherit
// these automatically (the storefront unions the category's own + ancestor
// assignments), so we only assign at the department (root) level.
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

async function seedCategoryAttributes() {
  console.log("\n🔗 Assigning attributes to departments...\n");
  let count = 0;

  for (const [deptSlug, keys] of Object.entries(departmentAttributes)) {
    const dept = await findCategoryByEnSlug(deptSlug);
    if (!dept) {
      console.log(`  ! skipped ${deptSlug} (department not found)`);
      continue;
    }

    for (const [index, key] of keys.entries()) {
      const attribute = await prisma.attribute.findUnique({ where: { key } });
      if (!attribute) {
        console.log(`  ! skipped ${deptSlug} -> ${key} (attribute not found)`);
        continue;
      }
      await prisma.categoryAttribute.upsert({
        where: {
          categoryId_attributeId: {
            categoryId: dept.id,
            attributeId: attribute.id,
          },
        },
        update: { order: index, isFilterable: true },
        create: {
          categoryId: dept.id,
          attributeId: attribute.id,
          order: index,
          isFilterable: true,
        },
      });
    }

    console.log(`  ✓ ${deptSlug} (${keys.length} attributes)`);
    count++;
  }

  console.log(`\n✅ Attribute assignments: ${count} departments configured.`);
}

async function seedAttributes() {
  console.log("\n🏷️  Seeding attributes...\n");
  let count = 0;

  for (const a of attributes) {
    const labelRows = toLabelRows(a.labels);
    const attribute = await prisma.attribute.upsert({
      where: { key: a.key },
      update: {
        type: a.type,
        unit: a.unit ?? null,
        order: a.order,
        translations: { deleteMany: {}, create: labelRows },
      },
      create: {
        key: a.key,
        type: a.type,
        unit: a.unit ?? null,
        order: a.order,
        translations: { create: labelRows },
      },
    });

    for (const opt of a.options ?? []) {
      await prisma.attributeOption.upsert({
        where: {
          attributeId_value: { attributeId: attribute.id, value: opt.value },
        },
        update: {
          order: opt.order,
          translations: { deleteMany: {}, create: toLabelRows(opt.labels) },
        },
        create: {
          attributeId: attribute.id,
          value: opt.value,
          order: opt.order,
          translations: { create: toLabelRows(opt.labels) },
        },
      });
    }

    const suffix = a.options ? ` (${a.options.length} options)` : a.unit ? ` (${a.unit})` : "";
    console.log(`  ✓ ${a.labels.en} [${a.type}]${suffix}`);
    count++;
  }

  console.log(`\n✅ Attributes: ${count} created/updated.`);
}

// ---------- Seed ----------

/**
 * Locate a category by its English-locale slug. The schema unique key is now
 * `@@unique([locale, slug])` on CategoryTranslation, so we go through that.
 */
async function findCategoryByEnSlug(slug: string) {
  const trans = await prisma.categoryTranslation.findUnique({
    where: { locale_slug: { locale: "en", slug } },
    select: { categoryId: true },
  });
  if (!trans) return null;
  return prisma.category.findUnique({ where: { id: trans.categoryId } });
}

function buildTranslationRows(names: LocaleNames, slug: string) {
  // Default-locale row always written from `names.en` + the canonical slug.
  // Non-default rows reuse the same slug for seed data (we don't currently
  // localize seed slugs - that's a manual step when sellers want it).
  return Object.entries(names).map(([locale, name]) => ({
    locale,
    name: name!,
    slug,
    description: null,
  }));
}

async function seed() {
  console.log("🌱 Seeding categories...\n");

  let deptCount = 0;
  let subCount = 0;

  for (const dept of departments) {
    let parent = await findCategoryByEnSlug(dept.slug);
    const rows = buildTranslationRows(dept.names, dept.slug);

    if (parent) {
      parent = await prisma.category.update({
        where: { id: parent.id },
        data: {
          order: dept.order,
          isActive: true,
          isFeatured: true,
          imageUrl: dept.imageUrl ?? null,
          // Replace-all on translations - small list, simpler than a per-row diff.
          translations: { deleteMany: {}, create: rows },
        },
      });
    } else {
      parent = await prisma.category.create({
        data: {
          order: dept.order,
          isActive: true,
          isFeatured: true,
          parentId: null,
          imageUrl: dept.imageUrl ?? null,
          translations: { create: rows },
        },
      });
    }

    console.log(`  ✓ ${dept.names.en}`);
    deptCount++;

    for (const sub of dept.children) {
      const child = await findCategoryByEnSlug(sub.slug);
      const subRows = buildTranslationRows(sub.names, sub.slug);

      if (child) {
        await prisma.category.update({
          where: { id: child.id },
          data: {
            order: sub.order,
            isActive: true,
            parentId: parent.id,
            translations: { deleteMany: {}, create: subRows },
          },
        });
      } else {
        await prisma.category.create({
          data: {
            order: sub.order,
            isActive: true,
            isFeatured: false,
            parentId: parent.id,
            translations: { create: subRows },
          },
        });
      }

      console.log(`      └─ ${sub.names.en}`);
      subCount++;
    }
  }

  console.log(
    `\n✅ Done: ${deptCount} departments, ${subCount} subcategories created/updated.`,
  );

  await seedAttributes();
  await seedCategoryAttributes();
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
