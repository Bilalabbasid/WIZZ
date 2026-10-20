// Curated, 100% unique, high-resolution Unsplash images for all 29 distinct products.
// Guaranteed: ZERO duplicate image URLs across any product or variant.
export const PRODUCT_IMAGE_REGISTRY: Record<
  string,
  {
    categorySlug: string;
    images: { url: string; altText: string; isThumbnail: boolean }[];
  }
> = {
  // 1. Audio & Headphones
  "WIZZ.PK Horizon Pro Wireless ANC Headphones": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ.PK Horizon Pro Wireless ANC Headphones in Matte Black",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
        altText: "Horizon Pro ANC Headphones Studio Soundstage",
        isThumbnail: false,
      },
    ],
  },
  // 2. Earbuds
  "WIZZ.PK SoundPod Pro Active Noise-Cancelling Earbuds": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ SoundPod Pro ANC True Wireless Earbuds in Charging Case",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=1000&q=80",
        altText: "SoundPod Pro Ergonomic Ear Tips and Transparency Mode",
        isThumbnail: false,
      },
    ],
  },
  // 3. Microphone
  "LuminaCraft StreamVoice XLR/USB Podcast Microphone": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft StreamVoice Studio Dynamic Microphone with Boom Arm",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1520523839898-5071221338ff?auto=format&fit=crop&w=1000&q=80",
        altText: "StreamVoice Cardioid Broadcast Pickup Pattern Close-up",
        isThumbnail: false,
      },
    ],
  },
  // 4. Power Bank
  "AeroGlide Prime 24,000mAh 140W Power Bank": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1609592426868-6c0b39a47d2f?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Prime 24000mAh 140W PD 3.1 Digital Display Power Bank",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Prime Fast Laptop Charging on Go",
        isThumbnail: false,
      },
    ],
  },
  // 5. GaN Charger
  "WIZZ.PK AeroCharge 100W GaN Travel Charger": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ AeroCharge 100W Quad-Port GaN Fast Wall Charger",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroCharge GaN Fast Charging Multi-Device Hub",
        isThumbnail: false,
      },
    ],
  },
  // 6. GPU
  "WIZZ Direct GeForce RTX 4080 Super OC 16GB": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Direct GeForce RTX 4080 Super OC 16GB Triple-Fan Graphics Card",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=1000&q=80",
        altText: "GeForce RTX 4080 Super Vapor Chamber Heatsink",
        isThumbnail: false,
      },
    ],
  },
  // 7. SSD
  "ApexTech UltraSpeed 2TB NVMe PCIe 4.0 SSD": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech UltraSpeed 2TB Gen4 M.2 NVMe SSD Heatsink Edition",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80",
        altText: "UltraSpeed 7400MB/s Read Speed NVMe Flash Memory",
        isThumbnail: false,
      },
    ],
  },
  // 8. Liquid Cooler
  "ApexTech HydroFreeze 360mm RGB Liquid Cooler": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech HydroFreeze 360mm AIO Liquid Cooler with ARGB Fans",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=1000&q=80",
        altText: "HydroFreeze 360 CPU Infinity Mirror Water Pump Block",
        isThumbnail: false,
      },
    ],
  },
  // 9. Precision Tool Kit
  "WIZZ.PK 1P Precision Titanium Screwdriver Kit (64 Bits)": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ.PK 1P Precision 64-Bit CNC Aluminum Screwdriver Set",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80",
        altText: "1P Titanium Magnetic Driver Bit Retention",
        isThumbnail: false,
      },
    ],
  },
  // 10. Thunderbolt Cable
  "ApexTech UltraSpeed Thunderbolt 4 240W Cable (2m)": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech UltraSpeed Thunderbolt 4 Braided 40Gbps 240W EPR Cable",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1616440349479-7f722a44e3a4?auto=format&fit=crop&w=1000&q=80",
        altText: "Thunderbolt 4 Zinc Alloy E-Marker Chip Connectors",
        isThumbnail: false,
      },
    ],
  },
  // 11. Smartwatch
  "WIZZ.PK ChronoTrack GPS AMOLED Smartwatch": {
    categorySlug: "electronics-audio",
    images: [
      {
        url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ ChronoTrack GPS AMOLED Titanium Sports Smartwatch",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1000&q=80",
        altText: "ChronoTrack 14-Day Battery Dual-Band GNSS Heart Rate Monitor",
        isThumbnail: false,
      },
    ],
  },
  // 12. Mechanical Keyboard (WIZZ)
  "WIZZ.PK Apex Ergonomic Mechanical Keyboard": {
    categorySlug: "work-productivity",
    images: [
      {
        url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Apex Ergonomic Custom Mechanical Keyboard",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Apex Mechanical Hot-Swap Switches Close-up",
        isThumbnail: false,
      },
    ],
  },
  // 13. CyberBlade Gaming Keyboard (ApexTech)
  "ApexTech CyberBlade Pro 75% Gaming Keyboard": {
    categorySlug: "work-productivity",
    images: [
      {
        url: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech CyberBlade Pro 75% Gasket-Mounted Gaming Keyboard",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1541140532154-b024d705b909?auto=format&fit=crop&w=1000&q=80",
        altText: "CyberBlade Pro Per-Key RGB Mechanical Keycaps",
        isThumbnail: false,
      },
    ],
  },
  // 14. Wireless Mouse
  "ApexTech Superlight 24K Wireless Optical Mouse": {
    categorySlug: "work-productivity",
    images: [
      {
        url: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=1000&q=80",
        altText: "ApexTech Superlight 24K Ultra-Lightweight Wireless Gaming Mouse",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80",
        altText: "Superlight 24K Precision Optical Sensor and PTFE Skates",
        isThumbnail: false,
      },
    ],
  },
  // 15. Light Bar
  "WIZZ.PK Lumina Desk Ambient Light Bar": {
    categorySlug: "work-productivity",
    images: [
      {
        url: "https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ Lumina Desk Ambient Light Bar Screen Mount",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80",
        altText: "Lumina Screenbar Warm Eye-Care Lighting",
        isThumbnail: false,
      },
    ],
  },
  // 16. Curved Monitor
  "LuminaCraft Horizon 34\" Curved 165Hz IPS Monitor": {
    categorySlug: "work-productivity",
    images: [
      {
        url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft Horizon 34 Inch Ultrawide Curved 165Hz WQHD Monitor",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1547119957-637f8679db17?auto=format&fit=crop&w=1000&q=80",
        altText: "Horizon 34 Ultrawide Productivity and Color Accuracy Display",
        isThumbnail: false,
      },
    ],
  },
  // 17. Standing Desk
  "LuminaCraft ErgoRise Dual-Motor Height Adjustable Desk": {
    categorySlug: "work-productivity",
    images: [
      {
        url: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1000&q=80",
        altText: "LuminaCraft ErgoRise Solid Oak Dual-Motor Electric Standing Desk",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1000&q=80",
        altText: "ErgoRise Smooth Anti-Collision Motor Control Panel",
        isThumbnail: false,
      },
    ],
  },
  // 18. Travel Backpack
  "WIZZ.PK Alpine Thermal Travel Backpack 35L": {
    categorySlug: "outdoor-travel-gear",
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
  // 19. Tactical Rucksack
  "Alpha Tactical Rucksack": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=1000&q=80",
        altText: "Alpha Tactical Molle Modular Field Expedition Rucksack",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1000&q=80",
        altText: "Alpha Tactical Heavy Duty Compression Straps and Sternum Buckle",
        isThumbnail: false,
      },
    ],
  },
  // 20. Insulated Water Bottle Flask
  "WIZZ.PK HydroShield Insulated Flask 1000ml": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=80",
        altText: "WIZZ HydroShield Stainless Vacuum Flask 1000ml",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=1000&q=80",
        altText: "HydroShield Insulated Flask Trail Outdoor",
        isThumbnail: false,
      },
    ],
  },
  // 21. Slim Card Wallet
  "AeroGlide Apex Slim Leather Card Wallet": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Apex Slim RFID Blocking Full-Grain Leather Cardholder",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Slim Wallet Quick Card Eject Feature",
        isThumbnail: false,
      },
    ],
  },
  // 22. Tactical Bifold Wallet
  "Tactical Leather Field Wallet": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1559563458-527698bf5295?auto=format&fit=crop&w=1000&q=80",
        altText: "Tactical Bifold Full-Grain Horween Leather Field Wallet",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1000&q=80",
        altText: "Tactical Field Wallet Hand-Stitched Waxed Thread Interior",
        isThumbnail: false,
      },
    ],
  },
  // 23. Leather Field Wallet Pro (Organizer)
  "Tactical Leather Field Wallet Pro": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1000&q=80",
        altText: "Tactical Leather Field Wallet Pro Passport and Notebook Organizer",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1585336261026-7f4115fec325?auto=format&fit=crop&w=1000&q=80",
        altText: "Field Wallet Pro YKK Brass Zipper and Pen Slot",
        isThumbnail: false,
      },
    ],
  },
  // 24. Tech Organizer Pouch
  "AeroGlide TechPack EDC Modular Pouch": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide TechPack 500D Cordura EDC Electronics Organizer Pouch",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=1000&q=80",
        altText: "TechPack Cable Elastic Loops and Water-Resistant Zippers",
        isThumbnail: false,
      },
    ],
  },
  // 25. Canvas Utility Pouch
  "Canvas EDC Utility Pouch": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80",
        altText: "Heavy Waxed 16oz Canvas EDC Roll-Up Tool and Gear Pouch",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1000&q=80",
        altText: "Waxed Canvas Water-Repellent Unfolded Tool Organizer",
        isThumbnail: false,
      },
    ],
  },
  // 26. Bushcraft Blade
  "Indus Gear Co Damascus Bushcraft Field Blade": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
        altText: "Indus Gear Damascus Steel Hand-Forged Full Tang Bushcraft Knife",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&w=1000&q=80",
        altText: "Damascus Field Blade Custom Hardwood Walnut Handle",
        isThumbnail: false,
      },
    ],
  },
  // 27. Titanium EDC Prybar
  "Aerospace Titanium EDC Prybar": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=1000&q=80",
        altText: "Aerospace Grade 5 Titanium Multi-Function Pocket EDC Prybar",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1000&q=80",
        altText: "Titanium Prybar Integrated Bottle Opener and Deep Carry Clip",
        isThumbnail: false,
      },
    ],
  },
  // 28. Carbon Marathon Shoes
  "AeroGlide Velocity Carbon Marathon Running Shoes": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80",
        altText: "AeroGlide Velocity Carbon Plate Elite Marathon Racing Shoes Crimson",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1000&q=80",
        altText: "Velocity Carbon Dual-Density Nitrogen Foam Outsole",
        isThumbnail: false,
      },
    ],
  },
  // 29. Trail Running Shoes
  "Beta Carbon Running Shoes": {
    categorySlug: "outdoor-travel-gear",
    images: [
      {
        url: "https://images.unsplash.com/photo-1551107696-a4b085a6d966?auto=format&fit=crop&w=1000&q=80",
        altText: "Beta Carbon Rugged All-Terrain Trail Running Shoes",
        isThumbnail: true,
      },
      {
        url: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1000&q=80",
        altText: "Beta Carbon Vibram Megagrip Lugged Outsole Profile",
        isThumbnail: false,
      },
    ],
  },
};
