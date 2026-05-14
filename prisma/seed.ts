import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------- Data ----------

type Translations = { sr?: { name?: string; description?: string } };
type SubCategory = { name: string; slug: string; order: number; translations?: Translations };

type Department = {
  name: string;
  slug: string;
  order: number;
  imageUrl?: string;
  translations?: Translations;
  children: SubCategory[];
};

const departments: Department[] = [
  {
    name: "Electronics",
    slug: "electronics",
    order: 1,
    translations: { sr: { name: "Elektronika" } },
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&q=80&auto=format&fit=crop",
    children: [
      { name: "Laptops & Computers", slug: "laptops-computers", order: 1, translations: { sr: { name: "Laptopi i računari" } } },
      { name: "Smartphones & Tablets", slug: "smartphones-tablets", order: 2, translations: { sr: { name: "Pametni telefoni i tableti" } } },
      { name: "TV & Audio", slug: "tv-audio", order: 3, translations: { sr: { name: "TV i audio" } } },
      { name: "Cameras & Photography", slug: "cameras-photography", order: 4, translations: { sr: { name: "Kamere i fotografija" } } },
      { name: "Gaming", slug: "gaming", order: 5, translations: { sr: { name: "Gejming" } } },
      { name: "Smart Home", slug: "smart-home", order: 6, translations: { sr: { name: "Pametni dom" } } },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    order: 2,
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Moda" } },
    children: [
      { name: "Men's Clothing", slug: "mens-clothing", order: 1, translations: { sr: { name: "Muška odeća" } } },
      { name: "Women's Clothing", slug: "womens-clothing", order: 2, translations: { sr: { name: "Ženska odeća" } } },
      { name: "Kids' Clothing", slug: "kids-clothing", order: 3, translations: { sr: { name: "Dečija odeća" } } },
      { name: "Shoes", slug: "shoes", order: 4, translations: { sr: { name: "Obuća" } } },
      { name: "Bags & Accessories", slug: "bags-accessories", order: 5, translations: { sr: { name: "Torbe i dodaci" } } },
      { name: "Jewelry & Watches", slug: "jewelry-watches", order: 6, translations: { sr: { name: "Nakit i satovi" } } },
    ],
  },
  {
    name: "Home & Garden",
    slug: "home-garden",
    order: 3,
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Dom i bašta" } },
    children: [
      { name: "Furniture", slug: "furniture", order: 1, translations: { sr: { name: "Nameštaj" } } },
      { name: "Kitchen & Dining", slug: "kitchen-dining", order: 2, translations: { sr: { name: "Kuhinja i trpezarija" } } },
      { name: "Bedding & Bath", slug: "bedding-bath", order: 3, translations: { sr: { name: "Posteljina i kupatilo" } } },
      { name: "Home Decor", slug: "home-decor", order: 4, translations: { sr: { name: "Dekoracija doma" } } },
      { name: "Garden & Outdoor", slug: "garden-outdoor", order: 5, translations: { sr: { name: "Bašta i eksterijer" } } },
      { name: "Lighting", slug: "lighting", order: 6, translations: { sr: { name: "Rasveta" } } },
    ],
  },
  {
    name: "Sports & Outdoors",
    slug: "sports-outdoors",
    order: 4,
    imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Sport i rekreacija" } },
    children: [
      { name: "Exercise & Fitness", slug: "exercise-fitness", order: 1, translations: { sr: { name: "Vežbanje i fitnes" } } },
      { name: "Outdoor Recreation", slug: "outdoor-recreation", order: 2, translations: { sr: { name: "Rekreacija na otvorenom" } } },
      { name: "Team Sports", slug: "team-sports", order: 3, translations: { sr: { name: "Ekipni sportovi" } } },
      { name: "Cycling", slug: "cycling", order: 4, translations: { sr: { name: "Biciklizam" } } },
      { name: "Water Sports", slug: "water-sports", order: 5, translations: { sr: { name: "Vodeni sportovi" } } },
    ],
  },
  {
    name: "Books & Media",
    slug: "books-media",
    order: 5,
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Knjige i mediji" } },
    children: [
      { name: "Books", slug: "books", order: 1, translations: { sr: { name: "Knjige" } } },
      { name: "Music", slug: "music", order: 2, translations: { sr: { name: "Muzika" } } },
      { name: "Movies & TV", slug: "movies-tv", order: 3, translations: { sr: { name: "Filmovi i TV" } } },
      { name: "Video Games", slug: "video-games", order: 4, translations: { sr: { name: "Video igrice" } } },
    ],
  },
  {
    name: "Health & Beauty",
    slug: "health-beauty",
    order: 6,
    imageUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Zdravlje i lepota" } },
    children: [
      { name: "Skincare", slug: "skincare", order: 1, translations: { sr: { name: "Nega kože" } } },
      { name: "Hair Care", slug: "hair-care", order: 2, translations: { sr: { name: "Nega kose" } } },
      { name: "Vitamins & Supplements", slug: "vitamins-supplements", order: 3, translations: { sr: { name: "Vitamini i suplementi" } } },
      { name: "Personal Care", slug: "personal-care", order: 4, translations: { sr: { name: "Lična higijena" } } },
      { name: "Fragrances", slug: "fragrances", order: 5, translations: { sr: { name: "Parfemi" } } },
    ],
  },
  {
    name: "Toys & Kids",
    slug: "toys-kids",
    order: 7,
    imageUrl: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Igračke i deca" } },
    children: [
      { name: "Toys & Games", slug: "toys-games", order: 1, translations: { sr: { name: "Igračke i igre" } } },
      { name: "Baby & Toddler", slug: "baby-toddler", order: 2, translations: { sr: { name: "Bebe i mala deca" } } },
      { name: "Educational", slug: "educational", order: 3, translations: { sr: { name: "Edukativno" } } },
      { name: "Arts & Crafts", slug: "arts-crafts", order: 4, translations: { sr: { name: "Umetnost i kreativnost" } } },
    ],
  },
  {
    name: "Automotive",
    slug: "automotive",
    order: 8,
    imageUrl: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=400&q=80&auto=format&fit=crop",
    translations: { sr: { name: "Auto-moto" } },
    children: [
      { name: "Car Electronics", slug: "car-electronics", order: 1, translations: { sr: { name: "Auto elektronika" } } },
      { name: "Parts & Accessories", slug: "parts-accessories", order: 2, translations: { sr: { name: "Delovi i dodaci" } } },
      { name: "Tools & Equipment", slug: "tools-equipment", order: 3, translations: { sr: { name: "Alati i oprema" } } },
      { name: "Care & Cleaning", slug: "car-care-cleaning", order: 4, translations: { sr: { name: "Pranje i održavanje" } } },
    ],
  },
];

// ---------- Seed ----------

async function seed() {
  console.log("🌱 Seeding categories...\n");

  let deptCount = 0;
  let subCount = 0;

  for (const dept of departments) {
    let parent = await prisma.category.findFirst({
      where: { slug: dept.slug, parentId: null },
    });

    if (parent) {
      parent = await prisma.category.update({
        where: { id: parent.id },
        data: { name: dept.name, order: dept.order, isActive: true, isFeatured: true, imageUrl: dept.imageUrl ?? null, translations: dept.translations ?? Prisma.JsonNull },
      });
    } else {
      parent = await prisma.category.create({
        data: {
          name: dept.name,
          slug: dept.slug,
          order: dept.order,
          isActive: true,
          isFeatured: true,
          parentId: null,
          imageUrl: dept.imageUrl ?? null,
          translations: dept.translations ?? Prisma.JsonNull,
        },
      });
    }

    console.log(`  ✓ ${parent.name}`);
    deptCount++;

    for (const sub of dept.children) {
      const child = await prisma.category.findFirst({
        where: { slug: sub.slug, parentId: parent.id },
      });

      if (child) {
        await prisma.category.update({
          where: { id: child.id },
          data: { name: sub.name, order: sub.order, isActive: true, translations: sub.translations ?? Prisma.JsonNull },
        });
      } else {
        await prisma.category.create({
          data: {
            name: sub.name,
            slug: sub.slug,
            order: sub.order,
            isActive: true,
            isFeatured: false,
            parentId: parent.id,
            translations: sub.translations ?? Prisma.JsonNull,
          },
        });
      }

      console.log(`      └─ ${sub.name}`);
      subCount++;
    }
  }

  console.log(
    `\n✅ Done: ${deptCount} departments, ${subCount} subcategories created/updated.`,
  );
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());