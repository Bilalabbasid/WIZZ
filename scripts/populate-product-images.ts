import { prisma } from "../src/lib/db";

// Curated high-res Unsplash product photography for hardware, gear, and tech
const TECH_IMAGE_POOLS: Record<string, { primary: string; secondary?: string; alt: string }> = {
  shoes: {
    primary: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80",
    alt: "Carbon Performance Running Shoes",
  },
  rucksack: {
    primary: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80",
    alt: "Tactical Modular Rucksack Pack",
  },
  pouch: {
    primary: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
    alt: "Canvas EDC Utility Pouch",
  },
  wallet: {
    primary: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80",
    alt: "Tactical Leather Field Wallet",
  },
  knife: {
    primary: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1000&q=80",
    alt: "Bushcraft Field Blade",
  },
  hardware_tool: {
    primary: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1000&q=80",
    alt: "Precision Titanium Hardware Tool",
  },
  keyboard: {
    primary: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1000&q=80",
    alt: "Mechanical Gaming Keyboard",
  },
  mouse: {
    primary: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80",
    alt: "Wireless Ultra-light Gaming Mouse",
  },
  headphones: {
    primary: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
    secondary: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
    alt: "Wireless Studio ANC Headphones",
  },
  earbuds: {
    primary: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80",
    alt: "True Wireless Noise-Cancelling Earbuds",
  },
  charger: {
    primary: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80",
    alt: "GaN Fast Charger Adapter",
  },
  storage: {
    primary: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1000&q=80",
    alt: "High-Speed NVMe Solid State Drive",
  },
  gpu: {
    primary: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1000&q=80",
    alt: "Graphics Accelerator GPU Card",
  },
  monitor: {
    primary: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1000&q=80",
    alt: "Ultrawide Gaming Monitor",
  },
};

const ROTATING_TECH = [
  TECH_IMAGE_POOLS.keyboard,
  TECH_IMAGE_POOLS.mouse,
  TECH_IMAGE_POOLS.headphones,
  TECH_IMAGE_POOLS.earbuds,
  TECH_IMAGE_POOLS.charger,
  TECH_IMAGE_POOLS.storage,
  TECH_IMAGE_POOLS.gpu,
  TECH_IMAGE_POOLS.monitor,
];

function selectImageForProduct(title: string, slug: string, index: number) {
  const lower = `${title} ${slug}`.toLowerCase();

  if (lower.includes("shoe") || lower.includes("running")) {
    return TECH_IMAGE_POOLS.shoes;
  }
  if (lower.includes("rucksack") || lower.includes("backpack") || lower.includes("bag")) {
    return TECH_IMAGE_POOLS.rucksack;
  }
  if (lower.includes("pouch") || lower.includes("canvas")) {
    return TECH_IMAGE_POOLS.pouch;
  }
  if (lower.includes("wallet")) {
    return TECH_IMAGE_POOLS.wallet;
  }
  if (lower.includes("knife") || lower.includes("bushcraft") || lower.includes("blade")) {
    return TECH_IMAGE_POOLS.knife;
  }
  if (lower.includes("tool") || lower.includes("hardware") || lower.includes("prybar")) {
    return TECH_IMAGE_POOLS.hardware_tool;
  }
  if (lower.includes("keyboard") || lower.includes("keycap")) {
    return TECH_IMAGE_POOLS.keyboard;
  }
  if (lower.includes("mouse")) {
    return TECH_IMAGE_POOLS.mouse;
  }
  if (lower.includes("headphone") || lower.includes("anc") || lower.includes("audio")) {
    return TECH_IMAGE_POOLS.headphones;
  }
  if (lower.includes("charger") || lower.includes("gan") || lower.includes("power")) {
    return TECH_IMAGE_POOLS.charger;
  }
  if (lower.includes("flask") || lower.includes("bottle")) {
    return {
      primary: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=80",
      alt: "Thermal Insulated Flask",
    };
  }

  // Fallback to rotating hardware pool
  return ROTATING_TECH[index % ROTATING_TECH.length];
}

async function main() {
  console.log("🔍 Checking products in database for missing images...");

  const products = await prisma.product.findMany({
    include: {
      media: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${products.length} total products in database.`);

  let addedCount = 0;
  let fixedTitles = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Clean up test artifact titles if present
    if (product.title.includes("HACKED OR UNAPPROVED")) {
      await prisma.product.update({
        where: { id: product.id },
        data: { title: "Tactical Leather Field Wallet" },
      });
      fixedTitles++;
    }

    if (product.media.length === 0) {
      const selected = selectImageForProduct(product.title, product.slug, i);

      // Create primary thumbnail
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          url: selected.primary,
          altText: `${product.title} - ${selected.alt}`,
          isThumbnail: true,
          displayOrder: 0,
        },
      });

      // Create optional secondary photo if available
      if (selected.secondary) {
        await prisma.productMedia.create({
          data: {
            productId: product.id,
            url: selected.secondary,
            altText: `${product.title} Detail View`,
            isThumbnail: false,
            displayOrder: 1,
          },
        });
      }

      addedCount++;
    }
  }

  console.log(`✅ Finished: Attached images to ${addedCount} products.`);
  if (fixedTitles > 0) {
    console.log(`✅ Normalized ${fixedTitles} titles.`);
  }

  // Final verification
  const stillWithoutMedia = await prisma.product.count({
    where: { media: { none: {} } },
  });
  console.log(`📊 Products without media remaining: ${stillWithoutMedia}`);
}

main()
  .catch((e) => {
    console.error("Error populating product images:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
