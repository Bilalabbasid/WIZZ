import type { SeedProductDef } from "./seed-complete-diverse-catalog";

/**
 * Additional demo catalog products (local development / staging only).
 * Photos are assigned from scripts/catalog-photos.ts, where every photo has been
 * checked by eye to show the product it is attached to.
 */

export const EXPANSION_CATEGORIES = [
  {
    name: "Kitchen & Dining",
    slug: "kitchen-dining",
    description: "Cookware, tableware and food storage for everyday Pakistani kitchens.",
    displayOrder: 5,
  },
  {
    name: "Sports & Fitness",
    slug: "sports-fitness",
    description: "Cricket gear, home workout equipment and training accessories.",
    displayOrder: 6,
  },
];

export const EXPANSION_REGISTRY: SeedProductDef[] = [
  // ---------------- Electronics & Audio ----------------
  {
    title: "WIZZ.PK Pulse Mini Waterproof Bluetooth Speaker",
    slug: "wizz-pulse-mini-waterproof-bluetooth-speaker",
    categorySlug: "electronics-audio",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 360,
    dimensions: { lengthMm: 95, widthMm: 95, heightMm: 110 },
    description: `### Pocket-Sized Sound for Every Room
The **Pulse Mini** packs a 10W full-range driver and passive bass radiator into a palm-sized body you can take from the kitchen to the rooftop.

#### Key Highlights
- **IPX7 Waterproof**: Survives rain, splashes and a dip in the pool.
- **14-Hour Battery**: USB-C charging, 2.5 hours from empty to full.
- **Bluetooth 5.3**: Stable connection up to 15 metres; pair two speakers for stereo.
- **Built-in Strap**: Hang it from a backpack or shower rail.

#### In the Box
- Pulse Mini speaker
- USB-C charging cable
- Quick start guide`,
    variants: [
      { title: "Charcoal Black", sku: "WZ-SPK-MINI-BLK", priceMinor: 699900, compareAtPriceMinor: 849900, stock: 60, attributes: { colour: "Charcoal Black" } },
      { title: "Ocean Blue", sku: "WZ-SPK-MINI-BLU", priceMinor: 699900, compareAtPriceMinor: 849900, stock: 35, attributes: { colour: "Ocean Blue" } },
    ],
    images: [],
  },
  {
    title: "ApexTech StreamCam 4K Webcam with Dual Microphones",
    slug: "apextech-streamcam-4k-webcam-dual-microphones",
    categorySlug: "electronics-audio",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 165,
    dimensions: { lengthMm: 95, widthMm: 35, heightMm: 60 },
    description: `### Look Sharp on Every Call
A 4K sensor with autofocus and automatic light correction keeps you clear on Zoom, Teams and Meet, even in a dim room.

#### Key Highlights
- **4K at 30fps / 1080p at 60fps** with fast autofocus.
- **Dual noise-reducing microphones** pick up your voice, not the ceiling fan.
- **Privacy shutter** slides over the lens when you're done.
- **Universal clip** fits monitors and laptops; standard tripod thread underneath.
- **Plug and play** over USB-C on Windows and macOS.`,
    variants: [{ title: "Standard", sku: "APX-CAM-4K-STD", priceMinor: 1499900, compareAtPriceMinor: null, stock: 28, attributes: { resolution: "4K" } }],
    images: [],
  },
  {
    title: "AeroGlide SmartFit S2 AMOLED Fitness Smartwatch",
    slug: "aeroglide-smartfit-s2-amoled-fitness-smartwatch",
    categorySlug: "electronics-audio",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 42,
    dimensions: { lengthMm: 45, widthMm: 38, heightMm: 11 },
    description: `### Track Your Day Without Charging Every Night
A bright 1.43" AMOLED display, built-in GPS and up to 10 days of battery life.

#### Key Highlights
- **Health tracking**: Heart rate, SpO2, sleep stages and stress.
- **100+ workout modes** including cricket, walking and cycling, with built-in GPS.
- **5 ATM water resistance** for swimming and rain.
- **Call and message alerts** from Android and iOS phones.
- **Up to 10 days** typical battery life; magnetic charger included.`,
    variants: [
      { title: "Midnight Black", sku: "AG-SW-S2-BLK", priceMinor: 1249900, compareAtPriceMinor: 1499900, stock: 40, attributes: { colour: "Midnight Black" } },
      { title: "Silver Grey", sku: "AG-SW-S2-SLV", priceMinor: 1249900, compareAtPriceMinor: 1499900, stock: 22, attributes: { colour: "Silver Grey" } },
    ],
    images: [],
  },

  // ---------------- Work & Productivity ----------------
  {
    title: "LuminaCraft Solid Walnut Monitor Stand Riser",
    slug: "luminacraft-solid-walnut-monitor-stand-riser",
    categorySlug: "work-productivity",
    brandName: "LuminaCraft",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 2400,
    dimensions: { lengthMm: 600, widthMm: 240, heightMm: 110 },
    description: `### Raise Your Screen, Clear Your Desk
Lifts your monitor to eye level and gives your keyboard a home underneath.

#### Key Highlights
- **Solid walnut top** with an oil finish; every grain pattern is unique.
- **60 cm wide** to fit monitors up to 32", or a laptop and speakers side by side.
- **Holds up to 25 kg** on powder-coated steel legs.
- **Cable slot** at the back keeps wires out of sight.`,
    variants: [{ title: "Walnut", sku: "LC-MSR-WAL-60", priceMinor: 749900, compareAtPriceMinor: null, stock: 30, attributes: { material: "Walnut", width: "60 cm" } }],
    images: [],
  },
  {
    title: "ApexTech 10-in-1 USB-C Multiport Hub",
    slug: "apextech-10-in-1-usb-c-multiport-hub",
    categorySlug: "work-productivity",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: true,
    weightGrams: 110,
    dimensions: { lengthMm: 120, widthMm: 45, heightMm: 15 },
    description: `### One Cable, Every Port
Turns a single USB-C port into a full desk setup.

#### Ports
- 1 × HDMI 4K@60Hz
- 3 × USB-A 3.2 (5 Gbps)
- 1 × USB-C data (5 Gbps)
- 1 × USB-C Power Delivery passthrough (100W)
- 1 × Gigabit Ethernet
- SD and microSD card readers
- 3.5mm audio

#### Good to Know
- Aluminium shell stays cool under load.
- Works with Windows laptops, MacBooks, iPad Pro and Android phones with DisplayPort Alt Mode.`,
    variants: [{ title: "Space Grey", sku: "APX-HUB-10IN1", priceMinor: 899900, compareAtPriceMinor: 1099900, stock: 55, attributes: { ports: "10" } }],
    images: [],
  },
  {
    title: "Indus Craft Full-Grain Leather A5 Notebook Cover",
    slug: "indus-craft-full-grain-leather-a5-notebook-cover",
    categorySlug: "work-productivity",
    brandName: "Indus Craft",
    sellerSlug: "indus-gear",
    featured: false,
    weightGrams: 240,
    dimensions: { lengthMm: 230, widthMm: 165, heightMm: 20 },
    description: `### Hand-Stitched in Pakistan
A refillable A5 notebook cover cut from full-grain cowhide and saddle-stitched by hand.

#### Key Highlights
- **Full-grain leather** that darkens and softens with use.
- **Refillable**: Includes one 192-page dotted A5 notebook; takes any standard A5 refill.
- **Pen loop and card pockets** inside the front cover.
- **Elastic closure** keeps loose pages in place.`,
    variants: [
      { title: "Tan Brown", sku: "IC-NBC-A5-TAN", priceMinor: 279900, compareAtPriceMinor: null, stock: 45, attributes: { colour: "Tan Brown" } },
      { title: "Dark Chocolate", sku: "IC-NBC-A5-CHO", priceMinor: 279900, compareAtPriceMinor: null, stock: 30, attributes: { colour: "Dark Chocolate" } },
    ],
    images: [],
  },

  // ---------------- Outdoor & Travel Gear ----------------
  {
    title: "AeroGlide Polycarbonate Hard-Shell Cabin Luggage 20\"",
    slug: "aeroglide-polycarbonate-hard-shell-cabin-luggage-20",
    categorySlug: "outdoor-travel-gear",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 2900,
    dimensions: { lengthMm: 550, widthMm: 380, heightMm: 230 },
    description: `### Cabin-Size, Built for Frequent Flyers
Sized for PIA, Airblue and most international carry-on limits.

#### Key Highlights
- **Polycarbonate shell** flexes on impact instead of cracking.
- **360° spinner wheels** with quiet double-wheel casters.
- **TSA-approved combination lock**.
- **Expandable zip** adds 4 cm of packing space.
- **Inside**: Compression straps and a zipped divider panel.`,
    variants: [
      { title: "Graphite", sku: "AG-LUG-20-GRP", priceMinor: 1899900, compareAtPriceMinor: 2299900, stock: 18, attributes: { colour: "Graphite", size: "20 inch" } },
      { title: "Sage Green", sku: "AG-LUG-20-SGE", priceMinor: 1899900, compareAtPriceMinor: 2299900, stock: 12, attributes: { colour: "Sage Green", size: "20 inch" } },
    ],
    images: [],
  },
  {
    title: "AeroGlide Trailhead 2-Person Waterproof Camping Tent",
    slug: "aeroglide-trailhead-2-person-waterproof-camping-tent",
    categorySlug: "outdoor-travel-gear",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 2100,
    dimensions: { lengthMm: 450, widthMm: 160, heightMm: 160 },
    description: `### Weekend Ready for Naran, Hunza or Your Rooftop
Sets up in under five minutes with two colour-coded poles.

#### Key Highlights
- **3000mm waterproof flysheet** with taped seams.
- **Two doors and two porches** so nobody climbs over anyone.
- **Mesh inner** for airflow on warm nights.
- **Packs down to 45 × 16 cm**, 2.1 kg trail weight.

#### In the Box
- Inner tent, flysheet and aluminium poles
- 12 stakes and guy lines
- Carry bag`,
    variants: [{ title: "Forest Green", sku: "AG-TNT-2P-GRN", priceMinor: 1599900, compareAtPriceMinor: null, stock: 15, attributes: { capacity: "2 person" } }],
    images: [],
  },
  {
    title: "WIZZ.PK Trail 1200-Lumen Rechargeable Headlamp",
    slug: "wizz-trail-1200-lumen-rechargeable-headlamp",
    categorySlug: "outdoor-travel-gear",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 95,
    dimensions: { lengthMm: 70, widthMm: 40, heightMm: 35 },
    description: `### Hands-Free Light for Load-Shedding and the Trail
Bright enough for night hikes, light enough to forget you're wearing it.

#### Key Highlights
- **1200 lumens** on boost, 5 brightness levels plus red night mode.
- **USB-C rechargeable**: up to 40 hours on the lowest setting.
- **IPX6 water resistant**.
- **Tilting head** and soft adjustable band.`,
    variants: [{ title: "Standard", sku: "WZ-HL-1200", priceMinor: 329900, compareAtPriceMinor: 399900, stock: 80, attributes: { output: "1200 lm" } }],
    images: [],
  },

  // ---------------- Home & Lifestyle ----------------
  {
    title: "LuminaCraft Hand-Poured Soy Candle Trio",
    slug: "luminacraft-hand-poured-soy-candle-trio",
    categorySlug: "home-lifestyle",
    brandName: "LuminaCraft",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 900,
    dimensions: { lengthMm: 260, widthMm: 90, heightMm: 95 },
    description: `### Three Scents, Clean Burn
Natural soy wax with cotton wicks in reusable glass jars.

#### In the Set
- **Oud & Amber**
- **Jasmine (Motia)**
- **Sandalwood & Vanilla**

#### Good to Know
- About 35 hours of burn time per candle.
- Trim the wick to 5 mm before each use for an even burn.`,
    variants: [{ title: "Trio Gift Set", sku: "LC-CND-TRIO", priceMinor: 249900, compareAtPriceMinor: null, stock: 70, attributes: { pieces: "3" } }],
    images: [],
  },
  {
    title: "LuminaCraft Matte Ceramic Planter Set (3 Pots)",
    slug: "luminacraft-matte-ceramic-planter-set-3-pots",
    categorySlug: "home-lifestyle",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 2600,
    dimensions: { lengthMm: 180, widthMm: 180, heightMm: 170 },
    description: `### Bring the Garden Indoors
Three nesting planters in a soft matte glaze, each with a drainage hole and saucer.

#### Sizes
- Small: 10 cm
- Medium: 13 cm
- Large: 16 cm

Plants not included.`,
    variants: [
      { title: "Chalk White", sku: "LC-PLN-SET3-WHT", priceMinor: 319900, compareAtPriceMinor: 389900, stock: 40, attributes: { colour: "Chalk White" } },
      { title: "Terracotta", sku: "LC-PLN-SET3-TER", priceMinor: 319900, compareAtPriceMinor: 389900, stock: 25, attributes: { colour: "Terracotta" } },
    ],
    images: [],
  },

  // ---------------- Kitchen & Dining ----------------
  {
    title: "WIZZ.PK Pre-Seasoned Cast Iron Skillet 26cm",
    slug: "wizz-pre-seasoned-cast-iron-skillet-26cm",
    categorySlug: "kitchen-dining",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 2700,
    dimensions: { lengthMm: 420, widthMm: 270, heightMm: 55 },
    description: `### One Pan for Parathas, Steaks and Shakshuka
Pre-seasoned with vegetable oil and ready to cook straight out of the box.

#### Key Highlights
- **Even heat** that holds steady for searing and tawa-style cooking.
- **Works on gas, electric, induction and in the oven.**
- **Gets better with use**: the seasoning builds a natural non-stick surface.

#### Care
- Wash with hot water, dry on the flame and wipe with a little oil.
- Not dishwasher safe.`,
    variants: [{ title: "26 cm", sku: "WZ-CI-SKL-26", priceMinor: 499900, compareAtPriceMinor: 599900, stock: 50, attributes: { diameter: "26 cm" } }],
    images: [],
  },
  {
    title: "LuminaCraft Stoneware Dinner Set (16 Pieces)",
    slug: "luminacraft-stoneware-dinner-set-16-pieces",
    categorySlug: "kitchen-dining",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 9500,
    dimensions: { lengthMm: 300, widthMm: 300, heightMm: 250 },
    description: `### Everyday Stoneware for Four
Reactive glaze with a speckled finish; no two pieces look exactly alike.

#### In the Set (Service for 4)
- 4 dinner plates (27 cm)
- 4 side plates (21 cm)
- 4 bowls (15 cm)
- 4 mugs (350 ml)

#### Good to Know
- Microwave and dishwasher safe.
- Packed with protective inserts for courier delivery.`,
    variants: [{ title: "Speckled Sand", sku: "LC-DIN-16-SND", priceMinor: 1199900, compareAtPriceMinor: null, stock: 14, attributes: { pieces: "16" } }],
    images: [],
  },
  {
    title: "WIZZ.PK 3-Tier Stainless Steel Tiffin Lunch Box",
    slug: "wizz-3-tier-stainless-steel-tiffin-lunch-box",
    categorySlug: "kitchen-dining",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 780,
    dimensions: { lengthMm: 150, widthMm: 150, heightMm: 230 },
    description: `### Ghar ka Khana, Wherever You Go
A classic three-tier tiffin in food-grade 304 stainless steel.

#### Key Highlights
- **Three 600 ml containers** for salan, rice and roti.
- **Leak-resistant silicone seals** on every lid.
- **Locking side clips** and a carry handle.
- **No plastic touches your food.** Dishwasher safe.`,
    variants: [{ title: "3 Tier", sku: "WZ-TIF-3T-SS", priceMinor: 229900, compareAtPriceMinor: null, stock: 90, attributes: { tiers: "3" } }],
    images: [],
  },
  {
    title: "Indus Craft Acacia Wood Cutting Board",
    slug: "indus-craft-acacia-wood-cutting-board",
    categorySlug: "kitchen-dining",
    brandName: "Indus Craft",
    sellerSlug: "indus-gear",
    featured: false,
    weightGrams: 1300,
    dimensions: { lengthMm: 400, widthMm: 280, heightMm: 25 },
    description: `### Gentle on Knives, Built to Last
A thick acacia board with a juice groove on one side and a flat serving face on the other.

#### Key Highlights
- **40 × 28 cm** surface for chopping vegetables and meat.
- **Deep juice groove** keeps counters clean.
- **Finished with food-safe mineral oil.**

#### Care
Hand wash and oil once a month. Not for the dishwasher.`,
    variants: [{ title: "Large", sku: "IC-CB-ACA-L", priceMinor: 289900, compareAtPriceMinor: 349900, stock: 35, attributes: { size: "40 × 28 cm" } }],
    images: [],
  },

  // ---------------- Sports & Fitness ----------------
  {
    title: "AeroGlide ProGrip 6mm Non-Slip Yoga Mat",
    slug: "aeroglide-progrip-6mm-non-slip-yoga-mat",
    categorySlug: "sports-fitness",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 1100,
    dimensions: { lengthMm: 610, widthMm: 150, heightMm: 150 },
    description: `### Grip That Holds When You Sweat
A 6 mm cushioned mat with a textured surface on both sides.

#### Key Highlights
- **183 × 61 cm**, 6 mm thick for knee and wrist comfort.
- **Non-slip texture** on top and bottom.
- **Carry strap included.**
- Wipe clean with a damp cloth.`,
    variants: [
      { title: "Teal", sku: "AG-YM-6MM-TEL", priceMinor: 349900, compareAtPriceMinor: null, stock: 60, attributes: { colour: "Teal" } },
      { title: "Purple", sku: "AG-YM-6MM-PUR", priceMinor: 349900, compareAtPriceMinor: null, stock: 45, attributes: { colour: "Purple" } },
    ],
    images: [],
  },
  {
    title: "AeroGlide Adjustable Dumbbell Set 20kg",
    slug: "aeroglide-adjustable-dumbbell-set-20kg",
    categorySlug: "sports-fitness",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 20500,
    dimensions: { lengthMm: 450, widthMm: 250, heightMm: 200 },
    description: `### A Home Gym in One Box
Two dumbbell handles and cast-iron plates that add up to 20 kg in total.

#### In the Box
- 2 chrome-knurled handles with spin-lock collars
- Plates: 4 × 2.5 kg, 4 × 1.25 kg
- Storage case

#### Good to Know
- Each dumbbell adjusts from 2.5 kg to 10 kg.
- Heavy item: delivered by courier to your door; please allow an extra day.`,
    variants: [{ title: "20 kg Set", sku: "AG-DB-ADJ-20", priceMinor: 1699900, compareAtPriceMinor: 1999900, stock: 12, attributes: { total: "20 kg" } }],
    images: [],
  },
  {
    title: "Indus Craft Grade-1 English Willow Cricket Bat",
    slug: "indus-craft-grade-1-english-willow-cricket-bat",
    categorySlug: "sports-fitness",
    brandName: "Indus Craft",
    sellerSlug: "indus-gear",
    featured: true,
    weightGrams: 1200,
    dimensions: { lengthMm: 860, widthMm: 108, heightMm: 65 },
    description: `### Hand-Made in Sialkot
Pressed and shaped by hand from Grade-1 English willow with straight grains and a big edge profile.

#### Key Highlights
- **Short Handle (SH)**, 1170–1200 g pick-up.
- **9–11 straight grains**, knocked-in and ready for net practice.
- **Cane handle** with a grip and anti-scuff sheet fitted.
- **Full cover** included.

Knock in for a further 2–3 hours before match use with a hard leather ball.`,
    variants: [{ title: "Short Handle", sku: "IC-CB-EW-SH", priceMinor: 2499900, compareAtPriceMinor: null, stock: 10, attributes: { size: "Short Handle", grade: "Grade 1" } }],
    images: [],
  },
  {
    title: "Indus Craft Match-Grade Leather Cricket Ball",
    slug: "indus-craft-match-grade-leather-cricket-ball",
    categorySlug: "sports-fitness",
    brandName: "Indus Craft",
    sellerSlug: "indus-gear",
    featured: false,
    weightGrams: 160,
    dimensions: { lengthMm: 75, widthMm: 75, heightMm: 75 },
    description: `### Four-Piece, Hand-Stitched Leather
A 156 g match ball with a pronounced seam, made in Sialkot for club and school cricket.

#### Key Highlights
- **Alum-tanned leather**, four-piece construction.
- **Cork and rubber core** for consistent bounce.
- **156 g**, men's regulation weight.`,
    variants: [
      { title: "Red", sku: "IC-BALL-LTH-RED", priceMinor: 249900, compareAtPriceMinor: null, stock: 100, attributes: { colour: "Red" } },
      { title: "White", sku: "IC-BALL-LTH-WHT", priceMinor: 269900, compareAtPriceMinor: null, stock: 60, attributes: { colour: "White" } },
    ],
    images: [],
  },
  {
    title: "AeroGlide Speed Skipping Rope with Ball Bearings",
    slug: "aeroglide-speed-skipping-rope-ball-bearings",
    categorySlug: "sports-fitness",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 180,
    dimensions: { lengthMm: 200, widthMm: 120, heightMm: 40 },
    description: `### Fast, Smooth, Tangle-Free
Ball-bearing handles and a coated steel cable for quick double-unders.

#### Key Highlights
- **Adjustable length** up to 3 m; trims to your height in a minute.
- **Foam-grip handles** that stay put with sweaty hands.
- **Spare cable** included.`,
    variants: [{ title: "Black", sku: "AG-JR-SPD-BLK", priceMinor: 149900, compareAtPriceMinor: 189900, stock: 120, attributes: { colour: "Black" } }],
    images: [],
  },
];
