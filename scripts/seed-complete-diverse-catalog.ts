import { prisma } from "../src/lib/db";
import { ProductStatus, ProductModerationStatus } from "@prisma/client";
import { EXPANSION_CATEGORIES, EXPANSION_REGISTRY } from "./catalog-expansion";
import { CATALOG_PHOTOS } from "./catalog-photos";

export interface SeedProductDef {
  title: string;
  slug: string;
  categorySlug: string;
  brandName: string;
  sellerSlug: string;
  description: string;
  featured: boolean;
  weightGrams: number;
  dimensions: { lengthMm: number; widthMm: number; heightMm: number };
  variants: Array<{
    title: string;
    sku: string;
    priceMinor: number;
    /** Regular "was" price; null when the product is not marked down. */
    compareAtPriceMinor: number | null;
    stock: number;
    attributes: Record<string, string>;
  }>;
  images: Array<{
    url: string;
    altText: string;
    isThumbnail: boolean;
  }>;
}

export const COMPLETE_CATALOG_REGISTRY: SeedProductDef[] = [
  // =========================================================================
  // 1. ELECTRONICS & AUDIO (8 Products)
  // =========================================================================
  {
    title: "WIZZ.PK Horizon Pro Wireless ANC Headphones",
    slug: "wizz-horizon-pro-wireless-anc-headphones",
    categorySlug: "electronics-audio",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 285,
    dimensions: { lengthMm: 195, widthMm: 175, heightMm: 80 },
    description: `### Flagship Studio Acoustic Performance
Experience high-fidelity audiophile acoustic clarity with the **WIZZ.PK Horizon Pro Wireless ANC Headphones**. Engineered with custom 40mm bio-cellulose drivers and hybrid feedforward/feedback active noise cancellation, the Horizon Pro silences ambient drone by up to -42dB.

#### Key Highlights
- **Hybrid Active Noise Cancellation**: Dual mic array cuts office chatter, aircraft cabin rumble, and urban bustle.
- **Hi-Res Wireless Audio**: Supports LDAC, AAC, and aptX Adaptive codecs up to 24-bit/96kHz.
- **55-Hour Playtime**: Fast charge via USB-C provides 5 hours of playback from a quick 10-minute top-up.
- **CloudFoam Ear Cushions**: Protein leather memory foam ear cups designed for non-fatiguing all-day sessions.

#### In The Box
- WIZZ.PK Horizon Pro Headphones
- Hard Shell EVA Magnetic Travel Case
- 3.5mm Gold-Plated Braided Audio Cable (1.2m)
- USB-C to USB-A Charging Cable
- Flight Adapter & Documentation`,
    variants: [
      {
        title: "Matte Black",
        sku: "WZ-HP-ANC-BLK",
        priceMinor: 2499900, // PKR 24,999
        compareAtPriceMinor: 2999900, // PKR 29,999 (17% off)
        stock: 50,
        attributes: { color: "Matte Black", edition: "Pro Flagship" },
      },
      {
        title: "Lunar Silver",
        sku: "WZ-HP-ANC-SLV",
        priceMinor: 2499900,
        compareAtPriceMinor: 2999900,
        stock: 35,
        attributes: { color: "Lunar Silver", edition: "Pro Flagship" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ.PK Horizon Pro Wireless ANC Headphones in Matte Black",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
        altText: "Horizon Pro ANC Studio Soundstage View",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK SoundPod Pro Active Noise-Cancelling Earbuds",
    slug: "wizz-soundpod-pro-anc-earbuds",
    categorySlug: "electronics-audio",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 52,
    dimensions: { lengthMm: 60, widthMm: 45, heightMm: 24 },
    description: `### Pocket-Sized Acoustic Mastery
The **WIZZ SoundPod Pro** brings cinema-grade spatial audio and active noise cancellation into an ultra-compact pocket format.

#### Key Highlights
- **Dynamic 11mm Graphene Drivers**: Deep punchy sub-bass with pristine vocal clarity.
- **IPX5 Water & Sweat Resistance**: Engineered for rigorous workouts, monsoons, and running.
- **Qi Wireless Charging**: USB-C fast charging plus drop-and-go Qi wireless pad compatibility.
- **Environmental Noise Cancellation (ENC)**: 6 beamforming microphones for crystal-clear phone calls.`,
    variants: [
      {
        title: "Glacier White",
        sku: "WZ-SP-PRO-WHT",
        priceMinor: 899900, // PKR 8,999
        compareAtPriceMinor: 1149900, // PKR 11,499 (22% off)
        stock: 60,
        attributes: { color: "Glacier White" },
      },
      {
        title: "Obsidian Black",
        sku: "WZ-SP-PRO-BLK",
        priceMinor: 899900,
        compareAtPriceMinor: 1149900,
        stock: 45,
        attributes: { color: "Obsidian Black" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ SoundPod Pro True Wireless Earbuds in Open Case",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=1000&q=80",
        altText: "SoundPod Pro Ergonomic Ear Tips and Sensor Array",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "LuminaCraft StreamVoice XLR/USB Podcast Microphone",
    slug: "luminacraft-streamvoice-xlr-usb-microphone",
    categorySlug: "electronics-audio",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 750,
    dimensions: { lengthMm: 210, widthMm: 65, heightMm: 65 },
    description: `### Broadcast-Grade Dynamic Studio Microphone
Designed for podcasters, voice actors, and competitive streamers, the **LuminaCraft StreamVoice** features dual XLR and USB-C connectivity with onboard DSP hardware.

#### Key Highlights
- **Dual XLR / USB-C Interface**: Direct plug-and-play USB connection or professional balanced XLR mixer interface.
- **Cardioid Polar Pattern**: Isolates vocal speech while rejecting keyboard clicks and room echoes.
- **Zero-Latency Headphone Monitoring**: 3.5mm jack with integrated volume and mic gain dials.
- **Integrated All-Metal Shockmount**: Prevents desk vibrations from bleeding into your broadcast.`,
    variants: [
      {
        title: "Matte Studio Black",
        sku: "LC-SV-MIC-BLK",
        priceMinor: 1450000, // PKR 14,500
        compareAtPriceMinor: 1800000, // PKR 18,000 (19% off)
        stock: 30,
        attributes: { color: "Matte Black", mount: "Desktop Base Included" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft StreamVoice Studio Microphone on Arm",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1520523839898-5071221338ff?auto=format&fit=crop&w=1000&q=80",
        altText: "StreamVoice Metal Grille and Broadcast Filter",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK AeroCharge 100W GaN Travel Charger",
    slug: "wizz-aerocharge-100w-gan-travel-charger",
    categorySlug: "electronics-audio",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 185,
    dimensions: { lengthMm: 68, widthMm: 68, heightMm: 31 },
    description: `### Ultra-Compact Gallium Nitride Fast Charging
Harnessing third-generation GaNFast semiconductor silicon, the **WIZZ AeroCharge 100W** powers laptops, tablets, and phones simultaneously in a chassis 40% smaller than legacy power bricks.

#### Key Highlights
- **100W Power Delivery 3.0**: Fast-charges a 16-inch MacBook Pro from 0 to 50% in just 32 minutes.
- **4 Ports (3x USB-C + 1x USB-A)**: Dynamic power allocation balances wattage across connected hardware.
- **ThermalGuard Active Cooling**: Monitored temperature sensors prevent overheating and power surges.
- **Foldable Pakistan/UK Pins**: Travel-ready compact form factor with international voltage (100–240V).`,
    variants: [
      {
        title: "Polar White",
        sku: "WZ-CHG-100W-WHT",
        priceMinor: 599900, // PKR 5,999
        compareAtPriceMinor: 749900, // PKR 7,499 (20% off)
        stock: 75,
        attributes: { color: "Polar White", power: "100W GaN" },
      },
      {
        title: "Carbon Black",
        sku: "WZ-CHG-100W-BLK",
        priceMinor: 599900,
        compareAtPriceMinor: 749900,
        stock: 50,
        attributes: { color: "Carbon Black", power: "100W GaN" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ AeroCharge 100W Quad-Port GaN Wall Charger",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroCharge GaN Fast Charging Hub Multi-Device",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "AeroGlide Prime 24,000mAh 140W Laptop Power Bank",
    slug: "aeroglide-prime-24000mah-140w-power-bank",
    categorySlug: "electronics-audio",
    brandName: "AeroGlide",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 530,
    dimensions: { lengthMm: 155, widthMm: 55, heightMm: 48 },
    description: `### Extreme High-Wattage Portable Power Station
Power your high-draw laptops and field gear anywhere with the **AeroGlide Prime 24,000mAh Power Bank**, delivering up to 140W single-port USB PD 3.1 output.

#### Key Highlights
- **140W Two-Way Fast Charging**: Recharges the power bank itself to 100% in under 55 minutes.
- **Smart Color TFT Display**: Shows real-time wattage in/out, temperature, battery health, and time-to-empty.
- **Flight Approved (86.4Wh)**: Permitted on all domestic and international commercial flights.
- **24,000mAh Massive Capacity**: Recharges an iPhone 16 up to 5 times or a MacBook Air up to 1.4 times.`,
    variants: [
      {
        title: "Space Gray / 24,000mAh",
        sku: "AG-PB-140W-GRY",
        priceMinor: 1699900, // PKR 16,999
        compareAtPriceMinor: 2199900, // PKR 21,999 (23% off)
        stock: 40,
        attributes: { capacity: "24,000mAh", output: "140W PD 3.1" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1609592426868-6c0b39a47d2f?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Prime 24000mAh 140W Digital Display Power Bank",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Prime Charging High-Draw Laptop On the Go",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ Direct GeForce RTX 4080 Super OC 16GB",
    slug: "wizz-direct-geforce-rtx-4080-super-oc-16gb",
    categorySlug: "electronics-audio",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 1680,
    dimensions: { lengthMm: 310, widthMm: 140, heightMm: 62 },
    description: `### Extreme Gaming & AI Workstation Graphics
Powered by the Ada Lovelace architecture, the **GeForce RTX 4080 Super OC** delivers breathtaking 4K gaming, DLSS 3 frame generation, and AI inference acceleration.

#### Key Highlights
- **10,240 CUDA Cores**: Blistering rasterization and hardware ray-tracing performance.
- **16GB GDDR6X VRAM**: 256-bit memory bus handling massive 4K texture packs and local LLM fine-tuning.
- **Triple Axial-Tech Fans**: Vapor chamber baseplate with composite heatpipes for whisper-quiet thermal loads.
- **Reinforced Aluminum Exo-Skeleton**: Prevents GPU sag with bundled anti-sag support bracket.`,
    variants: [
      {
        title: "16GB OC Edition",
        sku: "WZ-GPU-4080S-OC",
        priceMinor: 28999900, // PKR 289,999
        compareAtPriceMinor: 31999900, // PKR 319,999 (9% off)
        stock: 12,
        attributes: { vram: "16GB GDDR6X", interface: "PCIe 4.0 x16" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1000&q=80",
        altText: "GeForce RTX 4080 Super Triple Fan Graphics Card",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=1000&q=80",
        altText: "RTX 4080 Super Vapor Chamber Heatsink and Backplate",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "ApexTech UltraSpeed 2TB NVMe PCIe 4.0 SSD",
    slug: "apextech-ultraspeed-2tb-nvme-pcie-4-ssd",
    categorySlug: "electronics-audio",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 45,
    dimensions: { lengthMm: 80, widthMm: 22, heightMm: 8 },
    description: `### Next-Gen Gen4 Solid State Drive Storage
Accelerate boot times, game level loading, and heavy 8K video timelines with the **ApexTech UltraSpeed 2TB NVMe SSD**, achieving read speeds up to 7,450 MB/s.

#### Key Highlights
- **PCIe 4.0 x4 Interface**: Up to 7,450 MB/s sequential read and 6,900 MB/s sequential write.
- **Pre-Installed Aluminum Heatsink**: Lowers thermal throttling during sustained data transfers (PS5 compatible).
- **DRAM Cache Buffer**: 2GB DDR4 cache for rapid random 4K IOPS read/write responsiveness.
- **1200 TBW Endurance**: Backed by a 5-year hardware replacement warranty.`,
    variants: [
      {
        title: "2TB with Heatsink",
        sku: "APX-SSD-2TB-HS",
        priceMinor: 2399900, // PKR 23,999
        compareAtPriceMinor: 2899900, // PKR 28,999 (17% off)
        stock: 50,
        attributes: { capacity: "2TB", formFactor: "M.2 2280" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech UltraSpeed 2TB Gen4 M.2 SSD with Heatsink",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech NVMe Circuit Controller and Flash Memory",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "ApexTech HydroFreeze 360mm RGB Liquid Cooler",
    slug: "apextech-hydrofreeze-360mm-rgb-liquid-cooler",
    categorySlug: "electronics-audio",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 1450,
    dimensions: { lengthMm: 397, widthMm: 120, heightMm: 27 },
    description: `### High-Efficiency CPU All-In-One Liquid Cooling
Tame demanding modern CPUs with the **ApexTech HydroFreeze 360mm AIO Cooler**, featuring high-static pressure fans and a mirror infinity RGB pump head.

#### Key Highlights
- **360mm Aluminum Radiator**: High-density fin array rapidly dissipates heat from multi-core processors.
- **Infinity Mirror ARGB Pump**: 3-phase motor provides quiet, continuous coolant circulation.
- **PWM Fluid Dynamic Bearing Fans**: 600–2000 RPM range with anti-vibration rubber corner dampers.
- **Universal Socket Compatibility**: Native bracket support for Intel LGA1700/1851 and AMD AM5/AM4.`,
    variants: [
      {
        title: "Stealth Black 360mm",
        sku: "APX-AIO-360-BLK",
        priceMinor: 1999900, // PKR 19,999
        compareAtPriceMinor: 2450000, // PKR 24,500 (18% off)
        stock: 28,
        attributes: { size: "360mm", color: "Stealth Black" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech HydroFreeze 360mm AIO Liquid Cooler with Fans",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=1000&q=80",
        altText: "HydroFreeze 360 CPU Infinity Mirror Pump Block",
        isThumbnail: false,
      },
    ],
  },

  // =========================================================================
  // 2. WORK & PRODUCTIVITY (8 Products)
  // =========================================================================
  {
    title: "WIZZ.PK Apex Ergonomic Mechanical Keyboard",
    slug: "wizz-apex-ergonomic-mechanical-keyboard",
    categorySlug: "work-productivity",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 980,
    dimensions: { lengthMm: 360, widthMm: 135, heightMm: 42 },
    description: `### Precision Mechanical Tactile Typing
Engineered for software engineers, authors, and data analysts, the **WIZZ.PK Apex Keyboard** combines a CNC aluminum plate with factory-lubricated mechanical switches.

#### Key Highlights
- **Hot-Swappable 5-Pin PCB**: Swap switches effortlessly without soldering.
- **Gasket-Mounted Acoustics**: PORON sound-absorbing foam creates a deep, satisfying acoustic thock.
- **PBT Double-Shot Keycaps**: Textured surface resists shine and oil buildup over years of typing.
- **Tri-Mode Connectivity**: Bluetooth 5.2, 2.4GHz low-latency wireless, and detachable USB-C.`,
    variants: [
      {
        title: "Tactile Silent / Space Gray",
        sku: "WZ-APX-KB-TAC",
        priceMinor: 1799900, // PKR 17,999
        compareAtPriceMinor: 2199900, // PKR 21,999 (18% off)
        stock: 45,
        attributes: { switch: "Tactile Silent", layout: "75% Compact" },
      },
      {
        title: "Linear Cream / Polar White",
        sku: "WZ-APX-KB-LIN",
        priceMinor: 1799900,
        compareAtPriceMinor: 2199900,
        stock: 35,
        attributes: { switch: "Linear Cream", layout: "75% Compact" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Apex Custom Mechanical Keyboard Desk View",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1000&q=80",
        altText: "Apex Hot-Swap Mechanical Switches and Keycap Detail",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "ApexTech CyberBlade Pro 75% Gasket Keyboard",
    slug: "apextech-cyberblade-pro-75-gasket-keyboard",
    categorySlug: "work-productivity",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 820,
    dimensions: { lengthMm: 325, widthMm: 135, heightMm: 38 },
    description: `### Vibrant RGB Gasket-Mounted Mechanical Board
The **ApexTech CyberBlade Pro** delivers per-key south-facing RGB lighting with an exploded 75% navigation cluster and a programmable rotary encoder knob.

#### Key Highlights
- **Multi-Function Aluminum Rotary Knob**: Adjust system volume, backlight brightness, or scrub timelines.
- **Polycarbonate Flex-Cut Plate**: Gentle typing rebound that alleviates finger strain during marathon work hours.
- **4,000mAh Rechargeable Battery**: Up to 200 hours of continuous operation with RGB toggled off.`,
    variants: [
      {
        title: "Cyber RGB / 75%",
        sku: "APX-CBL-75-RGB",
        priceMinor: 1349900, // PKR 13,499
        compareAtPriceMinor: 1699900, // PKR 16,999 (21% off)
        stock: 50,
        attributes: { color: "Cyber Gray", switch: "Yellow Linear" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech CyberBlade Pro 75% Gasket Mechanical Keyboard",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1541140532154-b024d705b909?auto=format&fit=crop&w=1000&q=80",
        altText: "CyberBlade Pro Per-Key Backlit Mechanical Keycaps",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "ApexTech Superlight 24K Wireless Optical Mouse",
    slug: "apextech-superlight-24k-wireless-optical-mouse",
    categorySlug: "work-productivity",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 58,
    dimensions: { lengthMm: 124, widthMm: 63, heightMm: 39 },
    description: `### Featherweight Ergonomic Precision Pointing
Weighing just 58 grams, the **ApexTech Superlight 24K** incorporates pure virgin-grade PTFE skates and a 26,000 DPI optical sensor with sub-millisecond motion sync.

#### Key Highlights
- **58g Ultra-Lightweight Shell**: No honeycomb holes; solid ergonomic chassis for comfortable claw or palm grip.
- **PAW3395 Optical Sensor**: 650 IPS tracking speed and 50G acceleration for pixel-precise cursor glide.
- **Optical Microswitches**: Rated for 90 million clicks with zero double-clicking debounce latency.
- **1KHz Polling Rate**: Zero lag wireless receiver included.`,
    variants: [
      {
        title: "Matte Black",
        sku: "APX-MS-24K-BLK",
        priceMinor: 949900, // PKR 9,499
        compareAtPriceMinor: 1199900, // PKR 11,999 (21% off)
        stock: 60,
        attributes: { color: "Matte Black", weight: "58g" },
      },
      {
        title: "Frost White",
        sku: "APX-MS-24K-WHT",
        priceMinor: 949900,
        compareAtPriceMinor: 1199900,
        stock: 40,
        attributes: { color: "Frost White", weight: "58g" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech Superlight 24K Wireless Optical Mouse",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80",
        altText: "Superlight 24K Ergonomic Contoured Grip Profile",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK Lumina Desk Ambient Screenbar Light",
    slug: "wizz-lumina-desk-ambient-screenbar-light",
    categorySlug: "work-productivity",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 420,
    dimensions: { lengthMm: 450, widthMm: 95, heightMm: 90 },
    description: `### Eye-Care Asymmetrical Monitor Illumination
Free up valuable desk real estate and eliminate eye strain with the **WIZZ.PK Lumina Screenbar**, engineered with an asymmetrical optical design that illuminates your desk without reflecting onto the glass screen.

#### Key Highlights
- **Asymmetric Optical Projection**: Zero screen glare; light falls purely across your keyboard and documents.
- **Stepless Dimming & Color Temp**: Adjust from warm 2700K relaxing light to cool 6500K focus light.
- **Weighted Counter-Balance Clamp**: Mounts securely onto flat or curved monitors (1cm to 5cm bezel thickness).
- **Auto-Dimming Ambient Sensor**: Built-in lux sensor automatically adjusts brightness to match ambient room conditions.`,
    variants: [
      {
        title: "Space Gray Anodized Aluminum",
        sku: "WZ-LUM-BAR-GRY",
        priceMinor: 649900, // PKR 6,499
        compareAtPriceMinor: 820000, // PKR 8,200 (21% off)
        stock: 55,
        attributes: { finish: "Anodized Aluminum", length: "450mm" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Lumina Desk Screenbar Mounted on Monitor",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80",
        altText: "Lumina Screenbar Warm Desk Workspace Illumination",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "LuminaCraft Horizon 34\" Curved 165Hz IPS Monitor",
    slug: "luminacraft-horizon-34-curved-165hz-ips-monitor",
    categorySlug: "work-productivity",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 7800,
    dimensions: { lengthMm: 808, widthMm: 460, heightMm: 235 },
    description: `### Immersive 21:9 WQHD Panoramic Productivity
Multiply your desktop real estate with the **LuminaCraft Horizon 34"**, featuring a 3440x1440 WQHD panel with 1900R curvature, 99% sRGB color gamut, and 90W USB-C single-cable power delivery.

#### Key Highlights
- **3440 x 1440 WQHD Ultrawide**: Equivalent to two side-by-side monitors without a distracting center bezel.
- **165Hz Refresh Rate & 1ms MPRT**: Buttery smooth cursor motion and fluid gaming response.
- **90W USB-C Hub**: Transmit video, audio, data, and power your laptop through a single cable.
- **KVM Switch Integrated**: Toggle keyboard and mouse between work laptop and gaming desktop seamlessly.`,
    variants: [
      {
        title: "34\" WQHD 165Hz",
        sku: "LC-MON-34-165",
        priceMinor: 12500000, // PKR 125,000
        compareAtPriceMinor: 14500000, // PKR 145,000 (14% off)
        stock: 15,
        attributes: { size: "34 Inch", resolution: "3440x1440 WQHD" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft Horizon 34 Ultrawide Curved Monitor",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1547119957-637f8679db17?auto=format&fit=crop&w=1000&q=80",
        altText: "Horizon 34 Color Accurate Ultrawide Workspace View",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "LuminaCraft ErgoRise Dual-Motor Electric Standing Desk",
    slug: "luminacraft-ergorise-dual-motor-electric-standing-desk",
    categorySlug: "work-productivity",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 32000,
    dimensions: { lengthMm: 1400, widthMm: 700, heightMm: 710 },
    description: `### Solid Oak Height-Adjustable Workstation
Transition seamlessly between sitting and standing with the **LuminaCraft ErgoRise**, built with dual heavy-duty whisper-quiet motors, a solid oak desktop, and smart anti-collision sensors.

#### Key Highlights
- **Dual Motor Drive**: 120kg weight capacity with smooth 35mm/s travel speed under full load.
- **Height Range 71cm to 120cm**: Accommodates users from 5'0" to 6'4" with four programmable memory presets.
- **Solid Solid Wood Desktop (140cm x 70cm)**: Beveled ergonomic comfort edge with durable polyurethane seal.
- **Under-Desk Cable Management**: Included steel wire tray hides power bars and power supplies neatly out of sight.`,
    variants: [
      {
        title: "Solid Oak / White Frame (140x70cm)",
        sku: "LC-DSK-OAK-WHT",
        priceMinor: 4899900, // PKR 48,999
        compareAtPriceMinor: 5800000, // PKR 58,000 (16% off)
        stock: 20,
        attributes: { top: "Solid Oak", frame: "White Steel", size: "140x70cm" },
      },
      {
        title: "Walnut / Black Frame (140x70cm)",
        sku: "LC-DSK-WAL-BLK",
        priceMinor: 4899900,
        compareAtPriceMinor: 5800000,
        stock: 18,
        attributes: { top: "Walnut", frame: "Black Steel", size: "140x70cm" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft ErgoRise Electric Sit-Stand Desk Setup",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1000&q=80",
        altText: "ErgoRise Smooth Anti-Collision Motor Control Panel",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "ApexTech UltraSpeed Thunderbolt 4 240W Cable (2m)",
    slug: "apextech-ultraspeed-thunderbolt-4-cable-2m",
    categorySlug: "work-productivity",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 95,
    dimensions: { lengthMm: 2000, widthMm: 12, heightMm: 6 },
    description: `### 40Gbps High-Speed Thunderbolt 4 / USB4 Certified Cable
Connect high-end monitors, external GPU enclosures, and NVMe RAID arrays with the **ApexTech UltraSpeed Thunderbolt 4 Cable**, supporting 240W EPR charging and dual 4K 120Hz displays.

#### Key Highlights
- **40Gbps Blazing Data Transfer**: Move 10GB of 4K footage in less than 3 seconds.
- **240W Extended Power Range (EPR)**: Future-proof charging for 140W+ gaming laptops and mobile workstations.
- **Dual 4K / Single 8K Video**: Crystal clear high-refresh display output.
- **Double-Braided Kevlar-Infused Jacket**: Tested for over 25,000 bend cycles with alloy connector heads.`,
    variants: [
      {
        title: "Braided Black / 2 Meters",
        sku: "APX-TB4-2M-BLK",
        priceMinor: 449900, // PKR 4,499
        compareAtPriceMinor: 550000, // PKR 5,500 (18% off)
        stock: 70,
        attributes: { length: "2.0 Meters", power: "240W EPR" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech UltraSpeed Thunderbolt 4 Braided Cable",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1616440349479-7f722a44e3a4?auto=format&fit=crop&w=1000&q=80",
        altText: "Thunderbolt 4 Zinc Alloy E-Marker Connectors Close-up",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "ApexTech Ergonomic Memory Foam Wrist Rest & Desk Mat",
    slug: "apextech-ergonomic-memory-foam-wrist-rest-desk-mat",
    categorySlug: "work-productivity",
    brandName: "ApexTech",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 420,
    dimensions: { lengthMm: 900, widthMm: 400, heightMm: 4 },
    description: `### Premium Wool-Felt Desk Pad & Cooling Wrist Support
Protect your desk surface and optimize typing ergonomics with the **ApexTech Desk Pad & Wrist Rest Combo**, featuring water-repellent felt and cooling gel memory foam.

#### Key Highlights
- **90cm x 40cm Large Desk Mat**: Accommodates full-size keyboard, mouse, phone, and mug with ease.
- **Cooling Gel Infused Foam**: Wrist rest dissipates wrist heat and neutralizes pressure points.
- **Anti-Slip Herringbone Rubber Base**: Keeps mat locked securely in place on glass, wood, or laminate.`,
    variants: [
      {
        title: "Charcoal Gray (90x40cm)",
        sku: "APX-MAT-SET-CHR",
        priceMinor: 299900, // PKR 2,999
        compareAtPriceMinor: 399900, // PKR 3,999 (25% off)
        stock: 65,
        attributes: { color: "Charcoal Gray", size: "900x400mm" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1589578228447-e1a4e481c6c8?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech Minimalist Felt Desk Mat and Keyboard Setup",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80",
        altText: "Desk Mat Textured Surface and Keyboard Accessories",
        isThumbnail: false,
      },
    ],
  },

  // =========================================================================
  // 3. OUTDOOR & TRAVEL GEAR (8 Products)
  // =========================================================================
  {
    title: "WIZZ.PK Alpine Thermal Travel Backpack 35L",
    slug: "wizz-alpine-thermal-travel-backpack-35l",
    categorySlug: "outdoor-travel-gear",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 1150,
    dimensions: { lengthMm: 520, widthMm: 330, heightMm: 210 },
    description: `### Weatherproof Expedition Travel Pack
Built from 840D ballistic nylon with TPU water-resistant coating, the **Alpine Thermal 35L** transition seamlessly between airport terminals, rugged treks, and urban commutes.

#### Key Highlights
- **Dedicated 16-inch Suspended Laptop Sleeve**: Padded false-bottom keeps your computer safe from hard drops.
- **Clamshell 180° Luggage Opening**: Packs flat like a suitcase with internal compression dividers.
- **Hidden Passport & RFID Pocket**: Protects personal credit cards and identification from electronic theft.
- **Luggage Pass-Through Strap**: Slides securely over rolling suitcase handles.`,
    variants: [
      {
        title: "Obsidian Black / 35L",
        sku: "WZ-ALP-BP-OBS",
        priceMinor: 1399900, // PKR 13,999
        compareAtPriceMinor: 1699900, // PKR 16,999 (18% off)
        stock: 45,
        attributes: { color: "Obsidian Black", capacity: "35 Liters" },
      },
      {
        title: "Storm Grey / 35L",
        sku: "WZ-ALP-BP-GRY",
        priceMinor: 1399900,
        compareAtPriceMinor: 1699900,
        stock: 35,
        attributes: { color: "Storm Grey", capacity: "35 Liters" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Alpine Thermal Backpack 35L Storm Grey",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80",
        altText: "Alpine Thermal 35L Ergonomic Load Straps",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "Alpha Tactical Molle Field Expedition Rucksack",
    slug: "alpha-tactical-molle-field-expedition-rucksack",
    categorySlug: "outdoor-travel-gear",
    brandName: "Alpha Craft",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 1400,
    dimensions: { lengthMm: 550, widthMm: 350, heightMm: 240 },
    description: `### Heavy-Duty Military Modular Expedition Pack
Crafted from mil-spec 1000D Cordura fabric with reinforced bar-tack stitching, the **Alpha Tactical Rucksack** features full laser-cut MOLLE webbing for modular gear attachment.

#### Key Highlights
- **Laser-Cut MOLLE System**: Attach extra utility pouches, canteen carriers, and tactical knives.
- **Hydration Bladder Compatible**: Internal sleeve and dual hose routing ports for up to 3L reservoirs.
- **Heavy-Duty YKK Dual Zippers**: Paracord pulls operate smoothly even with heavy tactical gloves.
- **Padded Ventilated Back Panel**: Breathable mesh air channels reduce back perspiration during long treks.`,
    variants: [
      {
        title: "Ranger Green / 40L",
        sku: "ALP-TAC-RCK-GRN",
        priceMinor: 1149900, // PKR 11,499
        compareAtPriceMinor: 1450000, // PKR 14,500 (21% off)
        stock: 40,
        attributes: { color: "Ranger Green", capacity: "40 Liters" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=1000&q=80",
        altText: "Alpha Tactical Molle Modular Expedition Rucksack",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1000&q=80",
        altText: "Alpha Tactical Heavy Duty Compression Straps",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK HydroShield Insulated Vacuum Flask 1000ml",
    slug: "wizz-hydroshield-insulated-vacuum-flask-1000ml",
    categorySlug: "outdoor-travel-gear",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 460,
    dimensions: { lengthMm: 290, widthMm: 85, heightMm: 85 },
    description: `### Double-Wall Vacuum Temperature Retention
Keep beverages ice cold for 24 hours or piping hot for 12 hours with the **HydroShield 1000ml Flask**, forged from kitchen-grade 18/8 food safe stainless steel.

#### Key Highlights
- **TempLock Double-Wall Vacuum**: Zero condensation on the outside; never sweats in backpacks.
- **Durable Powder-Coat Finish**: Slip-free grip that resists scratches, dents, and dishwasher cycles.
- **Leakproof Chug Cap with Carry Loop**: Wide mouth accommodates large ice cubes easily.
- **BPA & Toxin Free**: Pure taste with zero metallic flavor transfer.`,
    variants: [
      {
        title: "Matte Desert Sand / 1000ml",
        sku: "WZ-HS-FLK-SND",
        priceMinor: 349900, // PKR 3,499
        compareAtPriceMinor: 420000, // PKR 4,200 (17% off)
        stock: 65,
        attributes: { color: "Desert Sand", volume: "1000ml" },
      },
      {
        title: "Stealth Black / 1000ml",
        sku: "WZ-HS-FLK-BLK",
        priceMinor: 349900,
        compareAtPriceMinor: 420000,
        stock: 55,
        attributes: { color: "Stealth Black", volume: "1000ml" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ HydroShield Stainless Vacuum Flask 1000ml",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=1000&q=80",
        altText: "HydroShield Insulated Flask Trail Outdoor Setting",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "AeroGlide Apex Slim Leather Cardholder Wallet",
    slug: "aeroglide-apex-slim-leather-cardholder-wallet",
    categorySlug: "outdoor-travel-gear",
    brandName: "AeroGlide",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 55,
    dimensions: { lengthMm: 100, widthMm: 68, heightMm: 10 },
    description: `### Minimalist Full-Grain RFID-Shielded Wallet
Ditch bulky pockets with the **AeroGlide Apex Slim**, crafted from premium Horween full-grain vegetable-tanned leather with quick-draw card access.

#### Key Highlights
- **Holds 6–8 Cards + Cash**: Dedicated front quick-draw slot for your most frequent payment card.
- **Integrated RFID Blocker**: Protects chips from wireless skimming at airports and metro stations.
- **Ages with Rich Patina**: Natural oils develop a unique, personalized luster over time.
- **Ultra-Slim Profile (10mm)**: Virtually invisible in front or back trouser pockets.`,
    variants: [
      {
        title: "Saddle Tan Leather",
        sku: "AG-WL-SLM-TAN",
        priceMinor: 249900, // PKR 2,499
        compareAtPriceMinor: 320000, // PKR 3,200 (22% off)
        stock: 80,
        attributes: { color: "Saddle Tan", material: "Full-Grain Leather" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Apex Slim Leather Cardholder Wallet",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Slim Wallet Quick Card Eject Feature",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "AeroGlide TechPack 500D Cordura EDC Pouch",
    slug: "aeroglide-techpack-500d-cordura-edc-pouch",
    categorySlug: "outdoor-travel-gear",
    brandName: "AeroGlide",
    sellerSlug: "alpha-craft",
    featured: false,
    weightGrams: 160,
    dimensions: { lengthMm: 220, widthMm: 140, heightMm: 60 },
    description: `### Modular Cordura Cable & Electronics Organizer
Keep charging cables, power banks, SSDs, and dongles securely organized with the **AeroGlide TechPack EDC Pouch**.

#### Key Highlights
- **500D Water-Repellent Cordura**: Tear-resistant exterior shields delicate electronics from splashes and abrasions.
- **Origami-Style Accordion Pockets**: Expands to swallow laptop chargers or compresses flat in your bag.
- **Elastic Cable Retention Loops**: Prevents wires from tangling into messy knots.
- **YKK Weatherproof Zippers**: Dual zipper sliders with silent rubberized pulls.`,
    variants: [
      {
        title: "Black Camo",
        sku: "AG-TP-EDC-CAM",
        priceMinor: 389900, // PKR 3,899
        compareAtPriceMinor: 499900, // PKR 4,999 (22% off)
        stock: 60,
        attributes: { pattern: "Black Camo", fabric: "500D Cordura" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide TechPack Cordura EDC Organizer Pouch",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=1000&q=80",
        altText: "TechPack Cable Elastic Loops and Water-Resistant Zippers",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "Indus Gear Co Damascus Steel Bushcraft Field Blade",
    slug: "indus-gear-co-damascus-bushcraft-field-blade",
    categorySlug: "outdoor-travel-gear",
    brandName: "Indus Gear Co",
    sellerSlug: "indus-gear",
    featured: true,
    weightGrams: 320,
    dimensions: { lengthMm: 240, widthMm: 40, heightMm: 22 },
    description: `### Hand-Forged Full Tang Bushcraft Survival Blade
Handcrafted in Wazirabad by master bladesmiths, the **Indus Damascus Bushcraft Blade** features 256 folded layers of 1095 and 15N20 high-carbon steel paired with a contoured walnut hardwood handle.

#### Key Highlights
- **Hand-Forged 256-Layer Damascus**: Exceptional edge retention and signature water-ripple pattern (58–60 HRC).
- **Full Tang Construction**: Heavy-duty spine engineered for batoning firewood and wilderness survival.
- **Natural Walnut Hardwood Handle**: Ergonomic palm swell pinned with brass mosaic rivets.
- **Vegetable-Tanned Cowhide Leather Sheath**: Includes heavy-duty belt loop and firesteel ferro rod holder.`,
    variants: [
      {
        title: "Walnut Handle with Leather Sheath",
        sku: "IND-DAM-BLD-WAL",
        priceMinor: 899900, // PKR 8,999
        compareAtPriceMinor: 1100000, // PKR 11,000 (18% off)
        stock: 35,
        attributes: { steel: "256 Layer Damascus", handle: "Walnut Hardwood" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
        altText: "Indus Gear Hand-Forged Damascus Steel Field Blade",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1000&q=80",
        altText: "Damascus Field Blade Custom Walnut Handle and Edge",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "Aerospace Grade 5 Titanium Multi-Tool Pocket Prybar",
    slug: "aerospace-titanium-edc-prybar",
    categorySlug: "outdoor-travel-gear",
    brandName: "Indus Gear Co",
    sellerSlug: "indus-gear",
    featured: false,
    weightGrams: 42,
    dimensions: { lengthMm: 115, widthMm: 20, heightMm: 6 },
    description: `### Indestructible CNC Machined EDC Utility Tool
Never ruin your knife tip again. The **Aerospace Titanium Prybar** is precision CNC milled from solid Grade 5 Ti-6Al-4V titanium for box opening, nail pulling, and prying.

#### Key Highlights
- **Grade 5 (Ti-6Al-4V) Titanium**: Ultra-lightweight (42g), 100% rustproof, and stronger than high-tensile steel.
- **Integrated Bottle Opener & Hex Wrench**: Dual utility tools built into the ergonomic grip.
- **Deep-Carry Titanium Pocket Clip**: Rides discreetly in pants or gear bags with zero pocket bulge.
- **Tritium Vial Slot**: Includes 1.5x6mm milled slot for aftermarket glow markers.`,
    variants: [
      {
        title: "Stonewashed Titanium",
        sku: "IND-TI-PRY-STN",
        priceMinor: 429900, // PKR 4,299
        compareAtPriceMinor: 549900, // PKR 5,499 (22% off)
        stock: 50,
        attributes: { material: "Grade 5 Titanium", finish: "Stonewashed" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=1000&q=80",
        altText: "Aerospace Grade 5 Titanium Pocket EDC Prybar",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1000&q=80",
        altText: "Titanium Prybar Integrated Bottle Opener and Deep Clip",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "AeroGlide Velocity Carbon Marathon Running Shoes",
    slug: "aeroglide-velocity-carbon-marathon-running-shoes",
    categorySlug: "outdoor-travel-gear",
    brandName: "AeroGlide",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 215,
    dimensions: { lengthMm: 310, widthMm: 110, heightMm: 120 },
    description: `### Carbon-Plated Performance Marathon Racers
Break personal records with the **AeroGlide Velocity Carbon**, combining a full-length spoon-shaped carbon propulsion plate with supercritical nitrogen-infused foam.

#### Key Highlights
- **Full-Length 3K Carbon Plate**: Provides explosive spring-loaded toe-off efficiency.
- **Supercritical PEBA Foam**: 85% energy return that spares calf and quad muscles over 42km.
- **AtomKnit Breathable Monomesh Upper**: Featherlight lockdown with zero water absorption.
- **Wet-Grip Traction Outsole**: High-traction rubber pods engineered for wet asphalt and sharp turns.`,
    variants: [
      {
        title: "Crimson Blaze / Size 42",
        sku: "AG-VEL-42-RED",
        priceMinor: 1849900, // PKR 18,499
        compareAtPriceMinor: 2200000, // PKR 22,000 (16% off)
        stock: 25,
        attributes: { color: "Crimson Blaze", size: "EU 42" },
      },
      {
        title: "Crimson Blaze / Size 43",
        sku: "AG-VEL-43-RED",
        priceMinor: 1849900,
        compareAtPriceMinor: 2200000,
        stock: 20,
        attributes: { color: "Crimson Blaze", size: "EU 43" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Velocity Carbon Elite Running Shoes Crimson",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80",
        altText: "Velocity Carbon Dual-Density Nitrogen Foam Outsole",
        isThumbnail: false,
      },
    ],
  },

  // =========================================================================
  // 4. HOME & LIFESTYLE (8 Products)
  // =========================================================================
  {
    title: "LuminaCraft Aromatherapy Ultrasonic Ceramic Diffuser",
    slug: "luminacraft-aromatherapy-ultrasonic-ceramic-diffuser",
    categorySlug: "home-lifestyle",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: true,
    weightGrams: 520,
    dimensions: { lengthMm: 140, widthMm: 140, heightMm: 180 },
    description: `### Minimalist Matte Ceramic Essential Oil Diffuser
Infuse your home with calming botanicals using the **LuminaCraft Ceramic Diffuser**, crafted from hand-poured stone ceramic with whisper-quiet ultrasonic atomization.

#### Key Highlights
- **Handmade Matte Ceramic Cover**: Seamless sculptural silhouette that complements any coffee table or nightstand.
- **Ultrasonic 2.4MHz Vibration**: Disperses ultra-fine essential oil vapor without heat degradation.
- **Ambient Warm Glow LED**: Subtle bottom ring light creates a calming candlelight atmosphere.
- **Auto-Shutoff Safety**: Shuts off automatically when water tank is empty (up to 8 hours run time).`,
    variants: [
      {
        title: "Matte White Ceramic",
        sku: "LC-DIF-CER-WHT",
        priceMinor: 489900, // PKR 4,899
        compareAtPriceMinor: 620000, // PKR 6,200 (21% off)
        stock: 45,
        attributes: { material: "Matte Ceramic", capacity: "180ml" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft Minimalist Matte Ceramic Aroma Diffuser",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80",
        altText: "Warm Ambient Glow and Ceramic Mist Atomizer",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK Precision Electric Gooseneck Pour-Over Kettle",
    slug: "wizz-precision-electric-gooseneck-pour-over-kettle",
    categorySlug: "home-lifestyle",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: true,
    weightGrams: 1100,
    dimensions: { lengthMm: 280, widthMm: 190, heightMm: 210 },
    description: `### Barista-Grade Precision Pour-Over Kettle
Master specialty coffee and artisanal tea with the **WIZZ.PK Gooseneck Kettle**, featuring degree-precise digital temperature control and an ergonomic balanced counterweight handle.

#### Key Highlights
- **1°F / 1°C Temperature Precision**: Dial in the exact extraction temperature (104°F to 212°F / 40°C to 100°C).
- **Elongated Gooseneck Spout**: Delivers an optimal 90° vertical pour with controlled laminar flow.
- **60-Minute Temperature Hold**: Keeps water held at your target temperature until you are ready to brew.
- **1200W Rapid Boil Element**: Boils 900ml of water in under 3.5 minutes.`,
    variants: [
      {
        title: "Matte Black / 900ml",
        sku: "WZ-KET-GNK-BLK",
        priceMinor: 1249900, // PKR 12,499
        compareAtPriceMinor: 1500000, // PKR 15,000 (17% off)
        stock: 35,
        attributes: { color: "Matte Black", capacity: "900ml" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Precision Matte Black Gooseneck Pour-Over Kettle",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1000&q=80",
        altText: "Pour-Over Coffee Brewing with Gooseneck Kettle",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "LuminaCraft Barista Conical Burr Coffee Grinder",
    slug: "luminacraft-barista-conical-burr-coffee-grinder",
    categorySlug: "home-lifestyle",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 1800,
    dimensions: { lengthMm: 190, widthMm: 130, heightMm: 310 },
    description: `### 40mm Stainless Steel Conical Burr Grinding Engine
Unlock the full aroma and terroir of fresh coffee beans with the **LuminaCraft Barista Grinder**, offering 48 micro-stepped settings from Turkish/Espresso to French Press.

#### Key Highlights
- **40mm CNC Machined Conical Burrs**: Minimizes grinding heat to preserve delicate volatile coffee oils.
- **48 Grind Size Settings**: Micro-adjustments dial in exact portafilter extraction times.
- **Anti-Static Dosing Technology**: Virtually eliminates messy coffee chaff clinging to your countertop.
- **Single-Dose Bellows Included**: Zero retention chamber clears out every single gram of ground coffee.`,
    variants: [
      {
        title: "Brushed Gunmetal",
        sku: "LC-GRN-BURR-GUN",
        priceMinor: 1599900, // PKR 15,999
        compareAtPriceMinor: 1950000, // PKR 19,500 (18% off)
        stock: 25,
        attributes: { finish: "Brushed Gunmetal", burrs: "40mm Conical" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft Barista Burr Coffee Grinder Setup",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?auto=format&fit=crop&w=1000&q=80",
        altText: "Fresh Espresso Grounds and Magnetic Dosing Cup",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK Nordic Wood Grain Smart Digital Alarm Clock",
    slug: "wizz-nordic-wood-grain-smart-digital-alarm-clock",
    categorySlug: "home-lifestyle",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 280,
    dimensions: { lengthMm: 150, widthMm: 70, heightMm: 45 },
    description: `### Minimalist Solid Wood Acoustic LED Timepiece
Elevate your nightstand aesthetics with the **WIZZ Nordic Clock**, blending a real beech wood veneer with modern through-wood LED illumination.

#### Key Highlights
- **Sound-Activated Display**: Tap your nightstand or clap to awaken the display; automatically dims at night.
- **Wireless Charging Top Pad (10W)**: Place your smartphone on top to charge overnight cord-free.
- **Dual Alarms with Weekday Mode**: Set discrete wake times for weekdays and weekends.
- **Temperature & Humidity Sensor**: Real-time ambient room climate readouts.`,
    variants: [
      {
        title: "Natural Beech Wood",
        sku: "WZ-CLK-NORD-BCH",
        priceMinor: 329900, // PKR 3,299
        compareAtPriceMinor: 420000, // PKR 4,200 (21% off)
        stock: 50,
        attributes: { wood: "Natural Beech", display: "Warm White LED" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Nordic Wood Grain Smart Digital Clock",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80",
        altText: "Nordic Digital Clock Bedside Nightstand Warm Styling",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "LuminaCraft Magnetic Induction Smart Night Light (2-Pack)",
    slug: "luminacraft-magnetic-induction-smart-night-light-2pack",
    categorySlug: "home-lifestyle",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 160,
    dimensions: { lengthMm: 180, widthMm: 25, heightMm: 25 },
    description: `### Cordless PIR Motion Sensor Wall Sconces
Illuminate hallways, stairwells, and closets automatically with the **LuminaCraft Magnetic Night Lights**, crafted with a walnut wood body and magnetic mounting base.

#### Key Highlights
- **Dual Infrared & Light Sensors**: 120° detection angle detects motion up to 4 meters away in the dark.
- **Magnetic Detachable Wand**: Pull the light wand off its magnetic base to use as an emergency flashlight.
- **500mAh USB-C Rechargeable**: Operates up to 3 months on motion sensor mode on a single charge.
- **Warm 2700K Eye-Comfort Lighting**: Soft indirect illumination that never jars your eyes late at night.`,
    variants: [
      {
        title: "Walnut Wood (2-Pack)",
        sku: "LC-NL-WAL-2PK",
        priceMinor: 269900, // PKR 2,699
        compareAtPriceMinor: 350000, // PKR 3,500 (23% off)
        stock: 60,
        attributes: { pack: "2 Units", wood: "Solid Walnut" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft Magnetic Induction Smart Wall Night Light",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1000&q=80",
        altText: "Hallway Soft Warm Light Illumination at Night",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "Indus Craft Hand-Cast Solid Brass Desk Organizer Tray",
    slug: "indus-craft-hand-cast-solid-brass-desk-tray",
    categorySlug: "home-lifestyle",
    brandName: "Indus Gear Co",
    sellerSlug: "indus-gear",
    featured: false,
    weightGrams: 640,
    dimensions: { lengthMm: 210, widthMm: 110, heightMm: 18 },
    description: `### Heavyweight Sand-Cast Solid Brass EDC Valet
Keep your keys, watch, rings, and brass fountain pens gracefully staged with the **Indus Craft Brass Valet Tray**, hand-cast from raw unlacquered brass.

#### Key Highlights
- **Solid Unlacquered Brass**: Substantial 640-gram weight anchors firmly to desks without sliding.
- **Natural Living Patina**: Will gradually oxidize and develop a dark, rich vintage character over decades.
- **Velvet Padded Underside**: Protects French-polished and delicate wood surfaces from scuffs.
- **Hand-Finished in Gujranwala**: Celebrates Pakistan's centuries-old traditional brass-smithing heritage.`,
    variants: [
      {
        title: "Raw Brushed Brass",
        sku: "IND-BRS-TRY-RAW",
        priceMinor: 399900, // PKR 3,999
        compareAtPriceMinor: 499900, // PKR 4,999 (20% off)
        stock: 40,
        attributes: { metal: "Solid Brass", finish: "Raw Brushed" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&w=1000&q=80",
        altText: "Indus Craft Hand-Cast Solid Brass Valet Tray",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&q=80",
        altText: "Brass Valet Tray Holding EDC Accessories on Desk",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "WIZZ.PK HydroPure Borosilicate Glass Water Carafe 2L",
    slug: "wizz-hydropure-borosilicate-glass-carafe-2l",
    categorySlug: "home-lifestyle",
    brandName: "WIZZ Direct",
    sellerSlug: "wizz-pk-direct",
    featured: false,
    weightGrams: 580,
    dimensions: { lengthMm: 135, widthMm: 135, heightMm: 240 },
    description: `### Elegant Dining Borosilicate Pitcher with Wood Stopper
Hydrate in style with the **WIZZ HydroPure Carafe**, hand-blown from thermal-shock resistant borosilicate glass with a natural solid oak spherical stopper.

#### Key Highlights
- **High-Borosilicate Glass (-20°C to 150°C)**: Safe for iced fruit infusions or hot boiling tea.
- **Solid Oak Sphere Stopper**: Seals out airborne dust while adding a warm Scandinavian aesthetic.
- **Drip-Free V-Spout**: Pours smoothly without dripping droplets down the carafe wall.
- **Extra-Wide 8cm Mouth**: Effortless to clean with a standard sponge or fill with whole lemon slices.`,
    variants: [
      {
        title: "Clear Borosilicate / 2.0L",
        sku: "WZ-CRF-GLS-2L",
        priceMinor: 549900, // PKR 5,499
        compareAtPriceMinor: 680000, // PKR 6,800 (19% off)
        stock: 35,
        attributes: { glass: "Borosilicate Glass", volume: "2.0 Liters" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ HydroPure Glass Carafe Pitcher with Wooden Stopper",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=1000&q=80",
        altText: "Pure Water Glass Set and Modern Dining Setting",
        isThumbnail: false,
      },
    ],
  },
  {
    title: "LuminaCraft Dual-Tone Woven Linen Storage Basket Cube",
    slug: "luminacraft-dual-tone-woven-linen-storage-basket-cube",
    categorySlug: "home-lifestyle",
    brandName: "LuminaCraft",
    sellerSlug: "beta-performance",
    featured: false,
    weightGrams: 420,
    dimensions: { lengthMm: 330, widthMm: 330, heightMm: 330 },
    description: `### Collapsible Heavyweight Fabric Closet Organizer
Declutter living rooms, wardrobes, and home offices with the **LuminaCraft Storage Cube**, made from thick cotton-linen fabric with vegan leather reinforced carry handles.

#### Key Highlights
- **33cm x 33cm Standard Cube**: Fits perfectly inside IKEA Kallax, Target, and custom modular shelving.
- **Reinforced Metal Rod Frame**: Upper metal perimeter keeps the cube standing erect even when empty.
- **Heavyweight 3-Layer Fabric**: Breathable linen outer layer with durable EVA polyester lining.
- **Foldable Space-Saving Design**: Folds completely flat to just 2cm thickness when not in active use.`,
    variants: [
      {
        title: "Oatmeal & Gray (33x33cm)",
        sku: "LC-BSK-LIN-OAT",
        priceMinor: 219900, // PKR 2,199
        compareAtPriceMinor: 280000, // PKR 2,800 (21% off)
        stock: 55,
        attributes: { fabric: "Heavy Cotton-Linen", size: "33x33x33cm" },
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1540518614846-7ede433c4ef4?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft Woven Linen Storage Cube in Living Room",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80",
        altText: "Shelving Modular Organizer Bins and Linen Fabric",
        isThumbnail: false,
      },
    ],
  },
];

/** Every product in the demo catalog, with photos from the verified photo list. */
function buildCatalog(): SeedProductDef[] {
  return [...COMPLETE_CATALOG_REGISTRY, ...EXPANSION_REGISTRY].map((def) => {
    const photos = CATALOG_PHOTOS[def.title];
    if (!photos) return def;
    return {
      ...def,
      images: photos.map((p, i) => ({ url: p.url, altText: p.alt, isThumbnail: i === 0 })),
    };
  });
}

async function main() {
  const CATALOG = buildCatalog();
  const missingPhotos = CATALOG.filter((p) => p.images.length === 0).map((p) => p.title);
  if (missingPhotos.length > 0) {
    console.error("Products without photos:", missingPhotos);
    process.exit(1);
  }

  console.log(`=== STEP 1: VALIDATING ${CATALOG.reduce((n, p) => n + p.images.length, 0)} IMAGES FOR UNIQUENESS ===`);
  const seenUrls = new Set<string>();
  const duplicateUrls: string[] = [];

  for (const product of CATALOG) {
    for (const img of product.images) {
      if (seenUrls.has(img.url)) {
        duplicateUrls.push(img.url);
      }
      seenUrls.add(img.url);
    }
  }

  if (duplicateUrls.length > 0) {
    console.error("Duplicate URLs detected in seed catalog:", duplicateUrls);
    process.exit(1);
  }
  console.log(`✔ Verified ${seenUrls.size} unique image URLs across ${CATALOG.length} products (0 duplicates).`);

  console.log("\n=== STEP 2: LOOKING UP CATEGORIES & SELLERS ===");
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

  const sellers = await prisma.sellerOrg.findMany();
  const sellerMap = new Map(sellers.map((s) => [s.slug, s.id]));

  // Ensure Home & Lifestyle category exists and is active
  let homeCatId = categoryMap.get("home-lifestyle");
  if (!homeCatId) {
    const newHomeCat = await prisma.category.create({
      data: {
        name: "Home & Lifestyle",
        slug: "home-lifestyle",
        description: "Artisanal coffee gear, ambient lighting, and minimalist home essentials",
        isActive: true,
        displayOrder: 4,
      },
    });
    homeCatId = newHomeCat.id;
    categoryMap.set("home-lifestyle", homeCatId);
    console.log("Created Home & Lifestyle category:", homeCatId);
  }

  // Create categories added by the catalog expansion
  for (const cat of EXPANSION_CATEGORIES) {
    if (!categoryMap.has(cat.slug)) {
      const created = await prisma.category.create({ data: { ...cat, isActive: true } });
      categoryMap.set(cat.slug, created.id);
      console.log(`Created ${cat.name} category`);
    }
  }

  // Fictional demo marketplace stores (no login accounts), so listings show more than one seller
  const DEMO_STORES = [
    { slug: "alpha-craft", name: "Alpha Craft Traders", legalName: "Alpha Craft Traders (Demo)", city: "Lahore" },
    { slug: "beta-performance", name: "Beta Performance Store", legalName: "Beta Performance Store (Demo)", city: "Karachi" },
    { slug: "indus-gear", name: "Indus Gear Co", legalName: "Indus Gear Co (Demo)", city: "Sialkot" },
  ];
  for (const store of DEMO_STORES) {
    if (!sellerMap.has(store.slug)) {
      const created = await prisma.sellerOrg.create({
        data: {
          ...store,
          contactEmail: `${store.slug}@demo.wizz.pk`,
          operationalStatus: "ACTIVE",
          commissionRatePercent: 10,
        },
      });
      sellerMap.set(store.slug, created.id);
      console.log(`Created demo store ${store.name}`);
    }
  }

  // Only the demo stores this catalog uses are activated; pending applicants are left alone
  const catalogSellerSlugs = Array.from(new Set(CATALOG.map((p) => p.sellerSlug)));
  await prisma.sellerOrg.updateMany({
    where: { slug: { in: catalogSellerSlugs } },
    data: { operationalStatus: "ACTIVE" },
  });

  const flagshipOrgId = sellerMap.get("wizz-pk-direct") || sellers[0]?.id;

  console.log(`\n=== STEP 3: SEEDING & SYNCING ALL ${CATALOG.length} PRODUCTS (INTERLEAVED ACROSS CATEGORIES) ===`);
  // Group by category to interleave
  const byCatMap = new Map<string, SeedProductDef[]>();
  for (const def of CATALOG) {
    const list = byCatMap.get(def.categorySlug) || [];
    list.push(def);
    byCatMap.set(def.categorySlug, list);
  }

  const interleaved: SeedProductDef[] = [];
  const catKeys = Array.from(byCatMap.keys());
  const rounds = Math.max(...Array.from(byCatMap.values()).map((l) => l.length));
  for (let round = 0; round < rounds; round++) {
    for (const key of catKeys) {
      const items = byCatMap.get(key)!;
      if (items[round]) {
        interleaved.push(items[round]);
      }
    }
  }

  const nowBase = Date.now();

  for (let i = 0; i < interleaved.length; i++) {
    const def = interleaved[i];
    const categoryId = categoryMap.get(def.categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found: ${def.categorySlug}`);
    }

    const sellerOrgId = sellerMap.get(def.sellerSlug) || flagshipOrgId;

    // Look for existing brand or create it
    let brand = await prisma.brand.findFirst({ where: { name: def.brandName } });
    if (!brand) {
      brand = await prisma.brand.create({
        data: {
          name: def.brandName,
          slug: def.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        },
      });
    }

    // Stagger createdAt so New Arrivals and Flash Deals have diverse categories
    const staggeredCreated = new Date(nowBase - (interleaved.length - i) * 60000);

    // Upsert product
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ slug: def.slug }, { title: def.title }],
      },
      include: { variants: true, media: true },
    });

    let productId: string;

    if (existing) {
      productId = existing.id;
      await prisma.product.update({
        where: { id: productId },
        data: {
          title: def.title,
          slug: def.slug,
          description: def.description,
          categoryId,
          brandId: brand.id,
          sellerOrgId,
          featured: def.featured,
          weightGrams: def.weightGrams,
          lengthMm: def.dimensions.lengthMm,
          widthMm: def.dimensions.widthMm,
          heightMm: def.dimensions.heightMm,
          status: ProductStatus.PUBLISHED,
          moderationStatus: ProductModerationStatus.APPROVED,
          isApprovedByPlatform: true,
          createdAt: staggeredCreated,
        },
      });
    } else {
      const created = await prisma.product.create({
        data: {
          title: def.title,
          slug: def.slug,
          description: def.description,
          categoryId,
          brandId: brand.id,
          sellerOrgId,
          featured: def.featured,
          weightGrams: def.weightGrams,
          lengthMm: def.dimensions.lengthMm,
          widthMm: def.dimensions.widthMm,
          heightMm: def.dimensions.heightMm,
          status: ProductStatus.PUBLISHED,
          moderationStatus: ProductModerationStatus.APPROVED,
          isApprovedByPlatform: true,
          createdAt: staggeredCreated,
        },
      });
      productId = created.id;
    }

    // Refresh media with the 2 unique verified images
    await prisma.productMedia.deleteMany({ where: { productId } });
    await prisma.productMedia.createMany({
      data: def.images.map((img, idx) => ({
        productId,
        url: img.url,
        altText: img.altText,
        isThumbnail: img.isThumbnail,
        displayOrder: idx,
      })),
    });

    // Sync variants
    for (const vDef of def.variants) {
      const existingVar = await prisma.productVariant.findFirst({
        where: { productId, sku: vDef.sku },
      });

      let variantId: string;
      if (existingVar) {
        variantId = existingVar.id;
        await prisma.productVariant.update({
          where: { id: variantId },
          data: {
            title: vDef.title,
            priceMinor: vDef.priceMinor,
            compareAtPriceMinor: vDef.compareAtPriceMinor,
            attributesJson: JSON.stringify(vDef.attributes),
            isActive: true,
            dealPriceMinor: null,
            dealStartsAt: null,
            dealEndsAt: null,
            dealRegularPriceMinor: null,
            dealRegularCompareAtMinor: null,
          },
        });
      } else {
        const createdVar = await prisma.productVariant.create({
          data: {
            productId,
            title: vDef.title,
            sku: vDef.sku,
            priceMinor: vDef.priceMinor,
            compareAtPriceMinor: vDef.compareAtPriceMinor,
            attributesJson: JSON.stringify(vDef.attributes),
            isActive: true,
          },
        });
        variantId = createdVar.id;
      }

      // Upsert inventory level
      const inv = await prisma.inventoryLevel.findFirst({
        where: { variantId },
      });

      if (inv) {
        await prisma.inventoryLevel.update({
          where: { id: inv.id },
          data: {
            availableUnits: vDef.stock,
            reservedUnits: 0,
            sellerOrgId,
          },
        });
      } else {
        await prisma.inventoryLevel.create({
          data: {
            variantId,
            sellerOrgId,
            availableUnits: vDef.stock,
            reservedUnits: 0,
          },
        });
      }
    }

    console.log(`✔ [${def.categorySlug}] "${def.title}" synced.`);
  }

  console.log("\n=== STEP 4: CLEANUP DUPLICATES OR UN-SEED TEST ARTIFACTS ===");
  // Archive any products that are not part of the canonical 32 registry
  const canonicalSlugs = new Set(CATALOG.map((p) => p.slug));
  const nonCanonical = await prisma.product.findMany({
    where: {
      slug: { notIn: Array.from(canonicalSlugs) },
      status: "PUBLISHED",
    },
  });

  if (nonCanonical.length > 0) {
    console.log(`Archiving ${nonCanonical.length} legacy/non-canonical products...`);
    await prisma.product.updateMany({
      where: { id: { in: nonCanonical.map((p) => p.id) } },
      data: { status: "ARCHIVED", isApprovedByPlatform: false },
    });
  }

  console.log("\n=== STEP 5: FINAL CATALOG VERIFICATION ===");
  const publishedProducts = await prisma.product.findMany({
    where: { status: "PUBLISHED", isApprovedByPlatform: true },
    include: {
      category: true,
      media: true,
      variants: true,
    },
  });

  console.log(`Total Published Products: ${publishedProducts.length}`);

  const byCat = new Map<string, number>();
  for (const p of publishedProducts) {
    byCat.set(p.category.name, (byCat.get(p.category.name) || 0) + 1);
  }

  for (const [catName, count] of byCat.entries()) {
    console.log(`  • ${catName}: ${count} products`);
  }

  const missingImg = publishedProducts.filter((p) => p.media.length === 0);
  console.log(`Published products missing media: ${missingImg.length}`);

  console.log("🎉 Complete diverse catalog seeding finished successfully!");
}

main().finally(() => prisma.$disconnect());
