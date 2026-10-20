import { prisma } from "../src/lib/db";
import { ProductStatus } from "@prisma/client";

interface SeedProductDef {
  title: string;
  slug: string;
  description: string;
  categorySlug: string;
  brandSlug: string;
  featured: boolean;
  weightGrams: number;
  primaryImage: string;
  secondaryImage?: string;
  variants: Array<{
    title: string;
    sku: string;
    priceMinor: number;
    compareAtPriceMinor?: number;
    stock: number;
    attributes: Record<string, string>;
  }>;
}

const DIVERSE_CATALOG: SeedProductDef[] = [
  // 1. Audio
  {
    title: "WIZZ.PK Horizon Pro Wireless ANC Headphones",
    slug: "wizz-horizon-pro-anc-headphones",
    description: "Custom 45mm neodymium acoustic drivers with hybrid active noise cancellation, 42-hour continuous battery life, and plush memory-foam ear cushions wrapped in vegan leather.",
    categorySlug: "electronics-audio",
    brandSlug: "wizz-core",
    featured: true,
    weightGrams: 285,
    primaryImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Matte Midnight / Standard",
        sku: "WZ-HP-ANC-BLK",
        priceMinor: 2499900, // PKR 24,999
        compareAtPriceMinor: 2999900,
        stock: 45,
        attributes: { color: "Matte Midnight", edition: "Standard" },
      },
      {
        title: "Platinum Silver / Standard",
        sku: "WZ-HP-ANC-SLV",
        priceMinor: 2499900,
        compareAtPriceMinor: 2999900,
        stock: 30,
        attributes: { color: "Platinum Silver", edition: "Standard" },
      },
    ],
  },

  // 2. Custom Mechanical Keyboard
  {
    title: "WIZZ.PK Apex Ergonomic Mechanical Keyboard",
    slug: "wizz-apex-mechanical-keyboard",
    description: "CNC-milled anodized aluminum chassis with hot-swappable PCB, gasket mount dampening, South-facing per-key RGB, and pre-lubed mechanical switches with double-shot PBT keycaps.",
    categorySlug: "work-productivity",
    brandSlug: "apextech",
    featured: true,
    weightGrams: 980,
    primaryImage: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Tactile Silent / Space Gray",
        sku: "WZ-APX-KB-TAC",
        priceMinor: 1799900, // PKR 17,999
        compareAtPriceMinor: 2199900,
        stock: 50,
        attributes: { switch: "Tactile Silent", finish: "Space Gray" },
      },
      {
        title: "Linear Smooth / Space Gray",
        sku: "WZ-APX-KB-LIN",
        priceMinor: 1799900,
        compareAtPriceMinor: 2199900,
        stock: 35,
        attributes: { switch: "Linear Smooth", finish: "Space Gray" },
      },
    ],
  },

  // 3. RGB Gaming Keyboard
  {
    title: "ApexTech CyberBlade Pro 75% Gaming Keyboard",
    slug: "apextech-cyberblade-pro-keyboard",
    description: "Ultra-fast 8000Hz polling rate mechanical keyboard with Hall Effect magnetic switches, rapid-trigger dynamic actuation, and sound-absorbing silicone layers.",
    categorySlug: "work-productivity",
    brandSlug: "apextech",
    featured: false,
    weightGrams: 850,
    primaryImage: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1563298723-dcfebaa392e3?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Magnetic Switches / RGB Onyx",
        sku: "APX-CB-75-ONYX",
        priceMinor: 2199900,
        compareAtPriceMinor: 2699900,
        stock: 28,
        attributes: { layout: "75%", color: "Onyx Black" },
      },
    ],
  },

  // 4. Wireless Gaming Mouse
  {
    title: "ApexTech Superlight 24K Wireless Optical Mouse",
    slug: "apextech-superlight-24k-mouse",
    description: "Featherweight 54-gram magnesium skeleton design with 26,000 DPI optical sensor, optical-mechanical switches, and zero-latency 2.4GHz wireless transmission.",
    categorySlug: "work-productivity",
    brandSlug: "apextech",
    featured: false,
    weightGrams: 54,
    primaryImage: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Polar White / 26K DPI",
        sku: "APX-MOU-WHT",
        priceMinor: 1199900,
        compareAtPriceMinor: 1450000,
        stock: 60,
        attributes: { color: "Polar White" },
      },
      {
        title: "Matte Black / 26K DPI",
        sku: "APX-MOU-BLK",
        priceMinor: 1199900,
        compareAtPriceMinor: 1450000,
        stock: 45,
        attributes: { color: "Matte Black" },
      },
    ],
  },

  // 5. GaN Charger
  {
    title: "WIZZ.PK AeroCharge 100W GaN Travel Charger",
    slug: "wizz-aerocharge-100w-gan-charger",
    description: "Next-generation Gallium Nitride (GaN) fast charger delivering 100W Power Delivery across 3 USB-C and 1 USB-A ports. Features universal plug adapters for Pakistan, US, UK, and EU.",
    categorySlug: "electronics-audio",
    brandSlug: "wizz-core",
    featured: true,
    weightGrams: 210,
    primaryImage: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1622445262464-84b14e323553?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Polar White / Multi-Port",
        sku: "WZ-CHG-100W-WHT",
        priceMinor: 599900, // PKR 5,999
        compareAtPriceMinor: 749900,
        stock: 88,
        attributes: { color: "Polar White", wattage: "100W" },
      },
    ],
  },

  // 6. High-Power Laptop Power Bank
  {
    title: "AeroGlide Prime 24,000mAh 140W Power Bank",
    slug: "aeroglide-prime-24000mah-powerbank",
    description: "Aircraft-grade aluminum casing with smart digital display showing live voltage and wattage. Dual 140W PD ports capable of charging a MacBook Pro 16\" to 50% in 28 minutes.",
    categorySlug: "electronics-audio",
    brandSlug: "aeroglide",
    featured: false,
    weightGrams: 540,
    primaryImage: "https://images.unsplash.com/photo-1609592424364-50a7c493a74d?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Gunmetal Gray / 140W PD",
        sku: "AERO-PB-24K-GRY",
        priceMinor: 1649900,
        compareAtPriceMinor: 1999900,
        stock: 40,
        attributes: { capacity: "24,000mAh", wattage: "140W" },
      },
    ],
  },

  // 7. True Wireless Earbuds
  {
    title: "WIZZ.PK SoundPod Pro Active Noise-Cancelling Earbuds",
    slug: "wizz-soundpod-pro-anc-earbuds",
    description: "Dual balanced armature drivers with LDAC Hi-Res Audio certification, wind-resistant microphones for clear calls, and IPX5 sweat-proof water resistance.",
    categorySlug: "electronics-audio",
    brandSlug: "wizz-core",
    featured: false,
    weightGrams: 55,
    primaryImage: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Onyx Black / Wireless Case",
        sku: "WZ-EAR-ANC-BLK",
        priceMinor: 949900,
        compareAtPriceMinor: 1199900,
        stock: 75,
        attributes: { color: "Onyx Black" },
      },
    ],
  },

  // 8. Streaming / Studio Microphone
  {
    title: "LuminaCraft StreamVoice XLR/USB Podcast Microphone",
    slug: "luminacraft-streamvoice-microphone",
    description: "Broadcast-grade dynamic microphone with dual XLR and USB-C connectivity, built-in headphone monitoring, touch mute strip, and built-in acoustic shock mount.",
    categorySlug: "electronics-audio",
    brandSlug: "luminacraft",
    featured: false,
    weightGrams: 620,
    primaryImage: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1583244532610-2a234e7c3eca?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Broadcast Matte Black",
        sku: "LUM-MIC-XLR-BLK",
        priceMinor: 1899900,
        compareAtPriceMinor: 2250000,
        stock: 32,
        attributes: { connector: "XLR / USB-C" },
      },
    ],
  },

  // 9. Graphics Card GPU
  {
    title: "WIZZ Direct GeForce RTX 4080 Super OC 16GB",
    slug: "wizz-geforce-rtx-4080-super-gpu",
    description: "Triple axial-tech cooling fans with vapor chamber heatsink, reinforced metal exoskeleton, and dual BIOS switch for whisper-quiet performance in 4K ray-traced gaming.",
    categorySlug: "electronics-audio",
    brandSlug: "wizz-core",
    featured: true,
    weightGrams: 1850,
    primaryImage: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "16GB GDDR6X / Overclocked Edition",
        sku: "WZ-GPU-4080S-16G",
        priceMinor: 28999900, // PKR 289,999
        compareAtPriceMinor: 31999900,
        stock: 12,
        attributes: { memory: "16GB GDDR6X", interface: "PCIe 4.0" },
      },
    ],
  },

  // 10. NVMe Solid State Drive
  {
    title: "ApexTech UltraSpeed 2TB NVMe PCIe 4.0 SSD",
    slug: "apextech-ultraspeed-2tb-nvme-ssd",
    description: "Sequential read speeds up to 7,450 MB/s with nickel-coated controller and integrated thermal graphene heat spreader. Fully compatible with PC desktop and PlayStation 5.",
    categorySlug: "electronics-audio",
    brandSlug: "apextech",
    featured: false,
    weightGrams: 35,
    primaryImage: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "2TB / Heatsink Edition",
        sku: "APX-SSD-2TB-HS",
        priceMinor: 2999900,
        compareAtPriceMinor: 3499900,
        stock: 45,
        attributes: { capacity: "2TB", formFactor: "M.2 2280" },
      },
    ],
  },

  // 11. Liquid AIO Cooler
  {
    title: "ApexTech HydroFreeze 360mm RGB Liquid Cooler",
    slug: "apextech-hydrofreeze-360-rgb-cooler",
    description: "High-density aluminum 360mm radiator with three 120mm fluid dynamic bearing fans and a customizable LCD pump head display for real-time CPU/GPU temperatures.",
    categorySlug: "electronics-audio",
    brandSlug: "apextech",
    featured: false,
    weightGrams: 1420,
    primaryImage: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "360mm / Triple ARGB Fans",
        sku: "APX-AIO-360-ARGB",
        priceMinor: 2399900,
        compareAtPriceMinor: 2799900,
        stock: 22,
        attributes: { radiator: "360mm", fans: "3x 120mm" },
      },
    ],
  },

  // 12. Desk Ambient Screenbar Light
  {
    title: "WIZZ.PK Lumina Desk Ambient Light Bar",
    slug: "wizz-lumina-desk-light-bar",
    description: "Asymmetric optical design illuminating your workspace without screen glare. Touch-sensitive wireless puck controller with stepless color temperature adjustment (2700K - 6500K).",
    categorySlug: "work-productivity",
    brandSlug: "luminacraft",
    featured: false,
    weightGrams: 520,
    primaryImage: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Standard / Dark Titanium",
        sku: "WZ-LUM-LB-STD",
        priceMinor: 899900, // PKR 8,999
        compareAtPriceMinor: 1099900,
        stock: 90,
        attributes: { finish: "Dark Titanium" },
      },
    ],
  },

  // 13. Ultrawide Gaming Monitor
  {
    title: "LuminaCraft Horizon 34\" Curved 165Hz IPS Monitor",
    slug: "luminacraft-horizon-34-curved-monitor",
    description: "UWQHD (3440 x 1440) resolution with 1900R curvature, 99% DCI-P3 color reproduction, 1ms response time, and 90W USB-C power delivery hub.",
    categorySlug: "work-productivity",
    brandSlug: "luminacraft",
    featured: true,
    weightGrams: 7200,
    primaryImage: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "34\" Curved / 165Hz IPS",
        sku: "LUM-MON-34-UW",
        priceMinor: 12500000, // PKR 125,000
        compareAtPriceMinor: 14500000,
        stock: 14,
        attributes: { size: "34 inch", refresh: "165Hz" },
      },
    ],
  },

  // 14. Travel Backpack
  {
    title: "WIZZ.PK Alpine Thermal Travel Backpack 35L",
    slug: "wizz-alpine-thermal-travel-backpack-35l",
    description: "Crafted from 840D ballistic recycled Cordura with weather-sealed YKK Aquaguard zippers. Features a dedicated TSA-approved 16\" laptop sleeve and concealed passport compartment.",
    categorySlug: "outdoor-travel-gear",
    brandSlug: "aeroglide",
    featured: true,
    weightGrams: 1150,
    primaryImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Obsidian Black / 35L",
        sku: "WZ-ALP-BP-OBS",
        priceMinor: 1399900, // PKR 13,999
        compareAtPriceMinor: 1699900,
        stock: 80,
        attributes: { color: "Obsidian Black", capacity: "35L" },
      },
      {
        title: "Forest Moss / 35L",
        sku: "WZ-ALP-BP-MST",
        priceMinor: 1399900,
        compareAtPriceMinor: 1699900,
        stock: 35,
        attributes: { color: "Forest Moss", capacity: "35L" },
      },
    ],
  },

  // 15. Insulated Flask
  {
    title: "WIZZ.PK HydroShield Insulated Flask 1000ml",
    slug: "wizz-hydroshield-insulated-flask",
    description: "Double-wall vacuum insulated 18/8 pro-grade stainless steel with powder-coat finish. Keeps liquids ice-cold for 24 hours or piping hot for 12 hours. Zero condensation.",
    categorySlug: "outdoor-travel-gear",
    brandSlug: "aeroglide",
    featured: false,
    weightGrams: 410,
    primaryImage: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Matte Black / 1000ml",
        sku: "WZ-HYD-FL-BLK",
        priceMinor: 349900, // PKR 3,499
        compareAtPriceMinor: 429900,
        stock: 120,
        attributes: { color: "Matte Black", capacity: "1000ml" },
      },
      {
        title: "Slate Blue / 1000ml",
        sku: "WZ-HYD-FL-BLU",
        priceMinor: 349900,
        compareAtPriceMinor: 429900,
        stock: 95,
        attributes: { color: "Slate Blue", capacity: "1000ml" },
      },
    ],
  },

  // 16. RFID Leather Field Wallet
  {
    title: "AeroGlide Apex Slim Leather Card Wallet",
    slug: "aeroglide-apex-slim-leather-wallet",
    description: "Precision-molded full-grain vegetable-tanned Italian leather with magnetic closure and built-in RFID blocking shield. Stores up to 10 cards and folded banknotes without bulk.",
    categorySlug: "outdoor-travel-gear",
    brandSlug: "aeroglide",
    featured: false,
    weightGrams: 65,
    primaryImage: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Cognac Brown / RFID Protected",
        sku: "AERO-WAL-CGN",
        priceMinor: 499900,
        compareAtPriceMinor: 620000,
        stock: 55,
        attributes: { color: "Cognac Brown" },
      },
    ],
  },

  // 17. EDC Organizer Pouch
  {
    title: "AeroGlide TechPack EDC Modular Pouch",
    slug: "aeroglide-techpack-edc-modular-pouch",
    description: "Weather-resistant recycled Kodra fabric with origami-style internal dividers, elastic cable loops, and external pen/stylus pocket.",
    categorySlug: "outdoor-travel-gear",
    brandSlug: "aeroglide",
    featured: false,
    weightGrams: 220,
    primaryImage: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Storm Gray / 2.5L",
        sku: "AERO-PCH-GRY",
        priceMinor: 429900,
        compareAtPriceMinor: 519900,
        stock: 65,
        attributes: { color: "Storm Gray" },
      },
    ],
  },

  // 18. Bushcraft Damascus Knife
  {
    title: "Indus Gear Co Damascus Bushcraft Field Blade",
    slug: "indus-gear-damascus-bushcraft-blade",
    description: "Hand-forged 67-layer Damascus steel blade with stabilized walnut burl handle, brass mosaic pins, and custom hand-stitched full-grain leather sheath.",
    categorySlug: "outdoor-travel-gear",
    brandSlug: "aeroglide",
    featured: false,
    weightGrams: 310,
    primaryImage: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Walnut Burl / Hand-Forged Damascus",
        sku: "IND-KNIFE-DAMAS",
        priceMinor: 899900,
        compareAtPriceMinor: 1100000,
        stock: 25,
        attributes: { steel: "Damascus 67-Layer", handle: "Walnut Burl" },
      },
    ],
  },

  // 19. Precision Screwdriver Tool Kit
  {
    title: "WIZZ.PK 1P Precision Titanium Screwdriver Kit (64 Bits)",
    slug: "wizz-1p-precision-screwdriver-kit",
    description: "Complete electronics repair toolkit featuring 64 precision S2 tool steel bits, magnetic aluminum screwdriver handle with ball-bearing swivel top, and magnetic bit case.",
    categorySlug: "electronics-audio",
    brandSlug: "wizz-core",
    featured: true,
    weightGrams: 360,
    primaryImage: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Space Gray Aluminum / 64 Bits",
        sku: "WZ-TOOL-64BIT-GRY",
        priceMinor: 499900, // PKR 4,999
        compareAtPriceMinor: 649900,
        stock: 90,
        attributes: { bitsCount: "64 Bits", caseMaterial: "Anodized Aluminum" },
      },
    ],
  },

  // 20. Braided Thunderbolt 4 Cable
  {
    title: "ApexTech UltraSpeed Thunderbolt 4 240W Cable (2m)",
    slug: "apextech-thunderbolt-4-cable-2m",
    description: "Intel-certified 40Gbps data transfer, 8K video output, and 240W Extended Power Range (EPR) fast charging with Kevlar-reinforced double braided nylon jacket.",
    categorySlug: "electronics-audio",
    brandSlug: "apextech",
    featured: false,
    weightGrams: 85,
    primaryImage: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Dark Titanium / 2 Meters",
        sku: "APX-TB4-2M-TIT",
        priceMinor: 449900,
        compareAtPriceMinor: 550000,
        stock: 110,
        attributes: { length: "2 Meters", power: "240W EPR" },
      },
    ],
  },

  // 21. Smart AMOLED GPS Fitness Watch
  {
    title: "WIZZ.PK ChronoTrack GPS AMOLED Smartwatch",
    slug: "wizz-chronotrack-gps-smartwatch",
    description: "1.43\" Ultra-bright 1000-nit AMOLED display, dual-frequency multi-satellite GPS, 14-day battery life, SpO2 blood oxygen sensor, and titanium alloy bezel.",
    categorySlug: "electronics-audio",
    brandSlug: "wizz-core",
    featured: true,
    weightGrams: 58,
    primaryImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Titanium Black / Silicone Band",
        sku: "WZ-WAT-GPS-BLK",
        priceMinor: 1999900,
        compareAtPriceMinor: 2399900,
        stock: 45,
        attributes: { color: "Titanium Black" },
      },
    ],
  },

  // 22. Motorized Standing Desk Frame
  {
    title: "LuminaCraft ErgoRise Dual-Motor Height Adjustable Desk",
    slug: "luminacraft-ergorise-dual-motor-desk",
    description: "Heavy-duty steel three-stage lifting columns supporting up to 140kg, anti-collision sensor, and 4 programmable memory presets with ultra-quiet (<45dB) dual motors.",
    categorySlug: "work-productivity",
    brandSlug: "luminacraft",
    featured: false,
    weightGrams: 28500,
    primaryImage: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Matte Black Dual-Motor Frame",
        sku: "LUM-DSK-DUAL-BLK",
        priceMinor: 4899900,
        compareAtPriceMinor: 5800000,
        stock: 18,
        attributes: { motor: "Dual Motor", color: "Matte Black" },
      },
    ],
  },

  // 23. Carbon Plate Performance Running Shoes
  {
    title: "AeroGlide Velocity Carbon Marathon Running Shoes",
    slug: "aeroglide-velocity-carbon-running-shoes",
    description: "Full-length carbon fiber propulsion plate sandwiched between nitrogen-infused supercritical PEBA foam. Engineered mono-mesh upper with high-traction Continental rubber outsole.",
    categorySlug: "outdoor-travel-gear",
    brandSlug: "aeroglide",
    featured: false,
    weightGrams: 215,
    primaryImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80",
    variants: [
      {
        title: "Crimson Carbon / EU 42",
        sku: "AERO-SHO-VEL-42",
        priceMinor: 1849900,
        compareAtPriceMinor: 2200000,
        stock: 25,
        attributes: { size: "EU 42", color: "Crimson Red" },
      },
      {
        title: "Crimson Carbon / EU 43",
        sku: "AERO-SHO-VEL-43",
        priceMinor: 1849900,
        compareAtPriceMinor: 2200000,
        stock: 30,
        attributes: { size: "EU 43", color: "Crimson Red" },
      },
    ],
  },
];

async function main() {
  console.log("🚀 Starting clean catalog re-seed with 100% distinct, unique images...");

  // 1. Get Flagship Seller
  const flagship = await prisma.sellerOrg.findFirst({
    where: { slug: "wizz-pk-direct" },
  });
  if (!flagship) {
    throw new Error("Flagship seller wizz-pk-direct not found!");
  }

  // 2. Archive / Delete test noise products
  console.log("🧹 Cleaning up duplicate test products...");
  const deleteNoise = await prisma.product.deleteMany({
    where: {
      OR: [
        { title: { startsWith: "Last Unit Race" } },
        { title: { startsWith: "Alpha Commerce" } },
        { title: { startsWith: "Beta Commerce" } },
        { title: { startsWith: "HACKED OR" } },
        { title: { startsWith: "WIZZ 1P Precision Tool v" } },
        { title: { startsWith: "Seller A Precision Hardware" } },
        { title: { startsWith: "Indus Bushcraft Hunting Knife" } },
      ],
    },
  });
  console.log(`✅ Removed ${deleteNoise.count} duplicate/test artifact products.`);

  // 3. Resolve Categories & Brands Maps
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

  const brands = await prisma.brand.findMany();
  const brandMap = new Map(brands.map((b) => [b.slug, b.id]));

  // 4. Upsert the 23 Distinct Real Products
  console.log("📦 Upserting 23 authentic products with 100% unique images...");

  for (const item of DIVERSE_CATALOG) {
    const categoryId = categoryMap.get(item.categorySlug);
    const brandId = brandMap.get(item.brandSlug);

    if (!categoryId || !brandId) {
      console.warn(`Skipping ${item.title}: category or brand not found`);
      continue;
    }

    // Upsert product
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        description: item.description,
        categoryId,
        brandId,
        featured: item.featured,
        weightGrams: item.weightGrams,
        status: ProductStatus.PUBLISHED,
        isApprovedByPlatform: true,
      },
      create: {
        sellerOrgId: flagship.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        categoryId,
        brandId,
        featured: item.featured,
        weightGrams: item.weightGrams,
        status: ProductStatus.PUBLISHED,
        isApprovedByPlatform: true,
      },
    });

    // Wipe old media for this product and re-attach distinct images
    await prisma.productMedia.deleteMany({ where: { productId: product.id } });

    await prisma.productMedia.create({
      data: {
        productId: product.id,
        url: item.primaryImage,
        altText: `${item.title} - Front View`,
        isThumbnail: true,
        displayOrder: 0,
      },
    });

    if (item.secondaryImage) {
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          url: item.secondaryImage,
          altText: `${item.title} - Detail Lifestyle`,
          isThumbnail: false,
          displayOrder: 1,
        },
      });
    }

    // Upsert variants
    for (const v of item.variants) {
      const variant = await prisma.productVariant.upsert({
        where: {
          productId_sku: {
            productId: product.id,
            sku: v.sku,
          },
        },
        update: {
          title: v.title,
          priceMinor: v.priceMinor,
          compareAtPriceMinor: v.compareAtPriceMinor || null,
          attributesJson: JSON.stringify(v.attributes),
          isActive: true,
        },
        create: {
          productId: product.id,
          sku: v.sku,
          title: v.title,
          priceMinor: v.priceMinor,
          compareAtPriceMinor: v.compareAtPriceMinor || null,
          attributesJson: JSON.stringify(v.attributes),
          isActive: true,
        },
      });

      // Upsert inventory
      await prisma.inventoryLevel.upsert({
        where: { variantId: variant.id },
        update: {
          availableUnits: v.stock,
          reservedUnits: 0,
        },
        create: {
          variantId: variant.id,
          sellerOrgId: flagship.id,
          availableUnits: v.stock,
          reservedUnits: 0,
        },
      });
    }
  }

  // 5. Final check
  const publishedProducts = await prisma.product.findMany({
    where: { status: ProductStatus.PUBLISHED },
    include: { media: true },
  });

  console.log(`\n🎉 Finished! Current published products in catalog: ${publishedProducts.length}`);
  const withoutMedia = publishedProducts.filter((p) => p.media.length === 0);
  console.log(`Products without media: ${withoutMedia.length}`);

  const distinctMediaUrls = new Set(
    publishedProducts.flatMap((p) => p.media.map((m) => m.url))
  );
  console.log(`Total unique media image URLs in catalog: ${distinctMediaUrls.size}`);
}

main()
  .catch((e) => {
    console.error("Error reseeding catalog:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
