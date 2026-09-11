// Realistic demo catalogue for RUVEN DEPT.
// Prices are in cents. Images are portrait product/editorial shots.

export type SeedReview = {
  author: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  daysAgo: number;
};

export type SeedProduct = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  collection: string;
  images: string[];
  sizes: string[];
  colors: string[];
  details: string[];
  featured?: boolean;
  isNew?: boolean;
  bestSeller?: boolean;
  stock?: number;
  reviews: SeedReview[];
};

const P = "https://images.pexels.com/photos";
const img = (id: number) =>
  `${P}/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1400&w=933`;

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const HAT_SIZES = ["One Size"];
const SHOE_SIZES = ["7", "8", "9", "10", "11", "12"];

export const CATEGORIES = [
  "Hoodies",
  "T-Shirts",
  "Jackets",
  "Pants",
  "Headwear",
  "Footwear",
] as const;

export const COLLECTIONS = [
  "Vault 01",
  "Static",
  "Terrain",
  "Relay",
  "Apex",
] as const;

export const seedProducts: SeedProduct[] = [
  // ---------------- HOODIES ----------------
  {
    slug: "vault-heavyweight-hoodie-black",
    name: "Vault Heavyweight Hoodie",
    tagline: "480 GSM boxy-fit fleece",
    description:
      "The cornerstone of the Vault line. Cut from 480 GSM loop-back cotton with a heavyweight drape that only gets better with wear. Dropped shoulders, a boxy body and a double-lined hood built to hold its shape season after season.",
    price: 14800,
    compareAtPrice: 18000,
    category: "Hoodies",
    collection: "Vault 01",
    images: [img(28701960), img(15127546), img(21356439)],
    sizes: APPAREL_SIZES,
    colors: ["Onyx", "Bone", "Slate"],
    details: [
      "480 GSM heavyweight loop-back cotton",
      "Boxy relaxed fit with dropped shoulders",
      "Double-lined hood with flat drawcords",
      "Ribbed cuffs and hem",
      "Garment-dyed for a lived-in tone",
    ],
    featured: true,
    bestSeller: true,
    reviews: [
      {
        author: "Marcus T.",
        rating: 5,
        title: "The last hoodie you'll buy",
        body: "Ridiculously heavy in the best way. The fabric feels premium and the boxy cut sits perfectly over a tee. Washed it three times, zero shrink.",
        verified: true,
        daysAgo: 6,
      },
      {
        author: "Devon K.",
        rating: 5,
        title: "Worth every cent",
        body: "I own four hoodies from big brands and this beats all of them. The hood actually stays up.",
        verified: true,
        daysAgo: 21,
      },
      {
        author: "Priya S.",
        rating: 4,
        title: "Great, size down",
        body: "Love the weight. It's genuinely oversized so I went from M to S and it's perfect.",
        verified: true,
        daysAgo: 40,
      },
    ],
  },
  {
    slug: "static-pullover-hoodie-bone",
    name: "Static Pullover Hoodie",
    tagline: "Washed cotton, tonal print",
    description:
      "A softer everyday pullover from the Static capsule. Mid-weight brushed-back fleece with a subtle tonal chest print and a relaxed hood. Your go-to for the in-between days.",
    price: 11800,
    category: "Hoodies",
    collection: "Static",
    images: [img(30283474), img(18398345), img(19225018)],
    sizes: APPAREL_SIZES,
    colors: ["Bone", "Washed Black", "Moss"],
    details: [
      "340 GSM brushed-back fleece",
      "Relaxed fit, true to size",
      "Tonal water-based chest print",
      "Kangaroo pocket with hidden pass-through",
    ],
    isNew: true,
    reviews: [
      {
        author: "Sam W.",
        rating: 5,
        title: "So soft",
        body: "The inside is like a cloud. Print is subtle and clean.",
        verified: true,
        daysAgo: 9,
      },
      {
        author: "Jordan L.",
        rating: 4,
        title: "Solid everyday hoodie",
        body: "Fit is relaxed but not huge. Bone color is a perfect off-white.",
        verified: true,
        daysAgo: 30,
      },
    ],
  },
  {
    slug: "relay-zip-hoodie-slate",
    name: "Relay Full-Zip Hoodie",
    tagline: "Technical brushed fleece",
    description:
      "Built for movement. The Relay zip-through pairs a brushed interior with a matte YKK zip and articulated sleeves. Layer it under a shell or wear it solo on transitional days.",
    price: 13600,
    category: "Hoodies",
    collection: "Relay",
    images: [img(15127546), img(16166526), img(4118956)],
    sizes: APPAREL_SIZES,
    colors: ["Slate", "Onyx"],
    details: [
      "360 GSM brushed cotton-blend fleece",
      "Matte YKK center-front zip",
      "Articulated sleeves for mobility",
      "Zip hand pockets",
    ],
    reviews: [
      {
        author: "Theo M.",
        rating: 5,
        title: "Perfect layer",
        body: "Zip quality is unreal. Wears great on its own too.",
        verified: true,
        daysAgo: 14,
      },
    ],
  },

  // ---------------- T-SHIRTS ----------------
  {
    slug: "core-boxy-tee-bone",
    name: "Core Boxy Tee",
    tagline: "240 GSM heavyweight jersey",
    description:
      "A perfected blank. Heavyweight 240 GSM jersey with a boxy body, wide ribbed collar and a clean hem. Structured enough to stand on its own, honest enough to layer forever.",
    price: 5400,
    category: "T-Shirts",
    collection: "Vault 01",
    images: [img(18398691), img(2451200), img(18398709)],
    sizes: APPAREL_SIZES,
    colors: ["Bone", "Onyx", "Clay", "Sage"],
    details: [
      "240 GSM combed ring-spun cotton",
      "Boxy fit with slightly cropped body",
      "Wide double-needle ribbed collar",
      "Pre-shrunk, garment-washed",
    ],
    featured: true,
    bestSeller: true,
    reviews: [
      {
        author: "Alex R.",
        rating: 5,
        title: "Best blank tee, period",
        body: "The weight and boxy cut are exactly right. Bought five.",
        verified: true,
        daysAgo: 4,
      },
      {
        author: "Nina P.",
        rating: 5,
        title: "Stands on its own",
        body: "Thick, structured, doesn't cling. Sage is beautiful.",
        verified: true,
        daysAgo: 18,
      },
      {
        author: "Chris D.",
        rating: 4,
        title: "Great fabric",
        body: "Wish it came in more colors. Quality is top tier.",
        verified: true,
        daysAgo: 33,
      },
    ],
  },
  {
    slug: "static-graphic-tee-washed-black",
    name: "Static Graphic Tee",
    tagline: "Hand-finished screen print",
    description:
      "A statement piece from Static. Oversized silhouette with a large-format back print and small chest hit, screen-printed on garment-dyed cotton for a faded, vintage hand-feel.",
    price: 6800,
    compareAtPrice: 8000,
    category: "T-Shirts",
    collection: "Static",
    images: [img(33222517), img(5524532), img(15123764)],
    sizes: APPAREL_SIZES,
    colors: ["Washed Black", "Vintage White"],
    details: [
      "220 GSM garment-dyed cotton",
      "Oversized drop-shoulder fit",
      "Discharge back print with plastisol chest hit",
      "Each piece varies slightly by design",
    ],
    isNew: true,
    reviews: [
      {
        author: "Riley F.",
        rating: 5,
        title: "Print is fire",
        body: "The back graphic is huge and the wash makes it look like I've had it for years.",
        verified: true,
        daysAgo: 7,
      },
      {
        author: "Mo A.",
        rating: 4,
        title: "Runs oversized",
        body: "Cool tee, definitely size down if you want a normal fit.",
        verified: true,
        daysAgo: 25,
      },
    ],
  },
  {
    slug: "apex-longsleeve-clay",
    name: "Apex Long-Sleeve",
    tagline: "Ribbed cuffs, layering cut",
    description:
      "A refined long-sleeve built for layering. Mid-weight cotton with ribbed cuffs and a slightly extended body so it peeks past your outerwear just right.",
    price: 6200,
    category: "T-Shirts",
    collection: "Apex",
    images: [img(13640870), img(2451200), img(30407760)],
    sizes: APPAREL_SIZES,
    colors: ["Clay", "Onyx", "Bone"],
    details: [
      "200 GSM combed cotton",
      "Regular fit with extended body",
      "Ribbed cuffs",
      "Tonal woven label",
    ],
    reviews: [
      {
        author: "Grace H.",
        rating: 5,
        title: "Layering staple",
        body: "Clay color is gorgeous and it fits under everything.",
        verified: true,
        daysAgo: 12,
      },
    ],
  },

  // ---------------- JACKETS ----------------
  {
    slug: "terrain-utility-jacket-olive",
    name: "Terrain Utility Jacket",
    tagline: "Water-resistant ripstop shell",
    description:
      "The anchor of the Terrain collection. A boxy utility overshirt-jacket in water-resistant ripstop, loaded with bellows pockets and finished with matte hardware. Built for the city and everything past it.",
    price: 24800,
    compareAtPrice: 29500,
    category: "Jackets",
    collection: "Terrain",
    images: [img(7880141), img(32517679), img(7880148)],
    sizes: APPAREL_SIZES,
    colors: ["Field Olive", "Onyx", "Sand"],
    details: [
      "Water-resistant cotton-nylon ripstop",
      "Four bellows cargo pockets",
      "Matte snap and zip hardware",
      "Adjustable hem drawcord",
      "Boxy relaxed fit",
    ],
    featured: true,
    bestSeller: true,
    reviews: [
      {
        author: "Owen B.",
        rating: 5,
        title: "Incredible jacket",
        body: "The pockets are functional and the fabric shrugs off light rain. Fit is perfect over a hoodie.",
        verified: true,
        daysAgo: 5,
      },
      {
        author: "Kai N.",
        rating: 5,
        title: "Instant favorite",
        body: "Hardware feels expensive. Olive is the move.",
        verified: true,
        daysAgo: 16,
      },
      {
        author: "Dana L.",
        rating: 4,
        title: "Great, bit boxy",
        body: "Really well made. It's quite boxy so keep that in mind.",
        verified: true,
        daysAgo: 44,
      },
    ],
  },
  {
    slug: "apex-puffer-jacket-amber",
    name: "Apex Cropped Puffer",
    tagline: "Recycled insulation, boxy fit",
    description:
      "Warmth without bulk. A cropped, boxy puffer with recycled synthetic fill, matte nylon shell and a high funnel neck that zips right up to your chin.",
    price: 27500,
    category: "Jackets",
    collection: "Apex",
    images: [img(14887834), img(11040450), img(23996611)],
    sizes: APPAREL_SIZES,
    colors: ["Amber", "Onyx"],
    details: [
      "Matte recycled nylon shell",
      "Recycled synthetic insulation",
      "High funnel neck with chin guard",
      "Two-way center-front zip",
    ],
    isNew: true,
    reviews: [
      {
        author: "Elle W.",
        rating: 5,
        title: "So warm, so clean",
        body: "The amber is such a statement and it's genuinely warm. Cropped fit is flattering.",
        verified: true,
        daysAgo: 8,
      },
    ],
  },
  {
    slug: "relay-coach-jacket-onyx",
    name: "Relay Coach Jacket",
    tagline: "Lightweight snap shell",
    description:
      "A timeless coach jacket reworked with a slightly longer body and matte snaps. Lightweight, packable and endlessly wearable across seasons.",
    price: 16800,
    category: "Jackets",
    collection: "Relay",
    images: [img(16283563), img(4118957), img(36484246)],
    sizes: APPAREL_SIZES,
    colors: ["Onyx", "Slate"],
    details: [
      "Peached poly-cotton shell",
      "Matte snap placket",
      "Elongated body",
      "Interior media pocket",
    ],
    reviews: [
      {
        author: "Ben C.",
        rating: 4,
        title: "Clean and versatile",
        body: "Goes with everything. Wish it had a slightly warmer lining.",
        verified: true,
        daysAgo: 22,
      },
    ],
  },

  // ---------------- PANTS ----------------
  {
    slug: "terrain-cargo-pant-olive",
    name: "Terrain Cargo Pant",
    tagline: "Tapered utility silhouette",
    description:
      "Utility done right. A tapered cargo cut in durable ripstop with anchored bellows pockets, an elasticated back waist and adjustable ankle cinches. Moves with you, holds everything.",
    price: 13800,
    compareAtPrice: 16000,
    category: "Pants",
    collection: "Terrain",
    images: [img(30415877), img(15553981), img(33672363)],
    sizes: ["28", "30", "32", "34", "36", "38"],
    colors: ["Field Olive", "Onyx", "Sand"],
    details: [
      "Durable cotton ripstop",
      "Tapered leg with ankle cinch",
      "Six-pocket utility layout",
      "Half-elasticated back waistband",
    ],
    featured: true,
    bestSeller: true,
    reviews: [
      {
        author: "Luca G.",
        rating: 5,
        title: "Perfect taper",
        body: "So many cargos are baggy at the ankle. These taper clean and stack just right over sneakers.",
        verified: true,
        daysAgo: 10,
      },
      {
        author: "Ava R.",
        rating: 5,
        title: "Everyday pant",
        body: "Comfortable enough to travel in, sharp enough for the city.",
        verified: true,
        daysAgo: 27,
      },
    ],
  },
  {
    slug: "vault-sweatpant-slate",
    name: "Vault Heavyweight Sweatpant",
    tagline: "Matching 480 GSM fleece",
    description:
      "The sweatpant half of the Vault set. Same 480 GSM loop-back fleece as the hoodie, cut with a relaxed straight leg and an elasticated tapered cuff.",
    price: 11200,
    category: "Pants",
    collection: "Vault 01",
    images: [img(15553981), img(21356439), img(30415877)],
    sizes: APPAREL_SIZES,
    colors: ["Slate", "Onyx", "Bone"],
    details: [
      "480 GSM heavyweight fleece",
      "Relaxed straight leg, cuffed hem",
      "Zip side pockets",
      "Flat drawcord waist",
    ],
    reviews: [
      {
        author: "Marcus T.",
        rating: 5,
        title: "Matches the hoodie perfectly",
        body: "Bought the set. Heavy, warm, and the color match is spot on.",
        verified: true,
        daysAgo: 6,
      },
    ],
  },
  {
    slug: "static-nylon-track-pant-black",
    name: "Static Nylon Track Pant",
    tagline: "Lined shell with piping",
    description:
      "A retro-leaning track pant in matte nylon with a soft jersey lining and tonal side piping. Snap-adjustable ankles let you wear them tapered or open.",
    price: 12400,
    category: "Pants",
    collection: "Static",
    images: [img(33672363), img(12212788), img(15553981)],
    sizes: APPAREL_SIZES,
    colors: ["Washed Black", "Slate"],
    details: [
      "Matte nylon shell, jersey lined",
      "Snap-adjustable ankle",
      "Tonal side piping",
      "Zip pockets",
    ],
    isNew: true,
    reviews: [
      {
        author: "Iris K.",
        rating: 4,
        title: "Comfy and clean",
        body: "Lining makes a huge difference. Great for lounging or out.",
        verified: true,
        daysAgo: 19,
      },
    ],
  },

  // ---------------- HEADWEAR ----------------
  {
    slug: "vault-beanie-onyx",
    name: "Vault Ribbed Beanie",
    tagline: "Merino-blend cuffed knit",
    description:
      "A dense ribbed beanie in a soft merino blend. Cuffed for a snug, structured fit with a woven tonal tab at the fold.",
    price: 4200,
    category: "Headwear",
    collection: "Vault 01",
    images: [img(7957209), img(9596577), img(17474889)],
    sizes: HAT_SIZES,
    colors: ["Onyx", "Bone", "Moss", "Amber"],
    details: [
      "Merino-acrylic ribbed knit",
      "Cuffed fit",
      "Woven tonal tab",
      "One size fits most",
    ],
    featured: true,
    reviews: [
      {
        author: "Sasha V.",
        rating: 5,
        title: "Soft, not itchy",
        body: "So many beanies itch — this one doesn't at all. Holds shape well.",
        verified: true,
        daysAgo: 11,
      },
      {
        author: "Tom E.",
        rating: 5,
        title: "Perfect fit",
        body: "Snug without being tight. Amber colorway is great.",
        verified: true,
        daysAgo: 29,
      },
    ],
  },
  {
    slug: "relay-6panel-cap-sand",
    name: "Relay 6-Panel Cap",
    tagline: "Washed unstructured crown",
    description:
      "A low-profile 6-panel in washed cotton twill with a soft unstructured crown, curved brim and an antique metal buckle strap for the perfect broken-in fit.",
    price: 4800,
    category: "Headwear",
    collection: "Relay",
    images: [img(20849745), img(20020627), img(5030327)],
    sizes: HAT_SIZES,
    colors: ["Sand", "Onyx", "Field Olive"],
    details: [
      "Washed cotton twill",
      "Unstructured soft crown",
      "Antique metal buckle strap",
      "Embroidered eyelets",
    ],
    isNew: true,
    reviews: [
      {
        author: "Nate P.",
        rating: 5,
        title: "Broken-in from day one",
        body: "Feels like an old favorite already. Strap adjusts perfectly.",
        verified: true,
        daysAgo: 15,
      },
    ],
  },

  // ---------------- FOOTWEAR ----------------
  {
    slug: "apex-low-sneaker-bone",
    name: "Apex Low Sneaker",
    tagline: "Leather upper, gum sole",
    description:
      "A clean court-inspired low top with a full-grain leather upper, cushioned insole and a natural gum outsole. Minimal branding, maximum wearability.",
    price: 15800,
    compareAtPrice: 18500,
    category: "Footwear",
    collection: "Apex",
    images: [img(18368099), img(12739973), img(18368120)],
    sizes: SHOE_SIZES,
    colors: ["Bone", "Onyx"],
    details: [
      "Full-grain leather upper",
      "Natural gum rubber outsole",
      "Cushioned OrthoLite-style insole",
      "Waxed cotton laces",
    ],
    featured: true,
    bestSeller: true,
    reviews: [
      {
        author: "Jules M.",
        rating: 5,
        title: "Comfortable + clean",
        body: "Leather is genuinely nice quality and the gum sole is comfy all day.",
        verified: true,
        daysAgo: 9,
      },
      {
        author: "Ray S.",
        rating: 4,
        title: "Great sneaker",
        body: "Runs slightly large, went half a size down. Love them.",
        verified: true,
        daysAgo: 31,
      },
    ],
  },
  {
    slug: "terrain-trail-sneaker-amber",
    name: "Terrain Trail Sneaker",
    tagline: "Rugged lug outsole",
    description:
      "Trail-ready but street-first. A chunky lugged outsole, protective toe cap and a breathable mesh-and-suede upper in earthy tones. Grip where you need it.",
    price: 17400,
    category: "Footwear",
    collection: "Terrain",
    images: [img(11919823), img(29573335), img(9400750)],
    sizes: SHOE_SIZES,
    colors: ["Amber", "Field Olive"],
    details: [
      "Mesh and suede upper",
      "Aggressive lug rubber outsole",
      "Protective molded toe cap",
      "Padded collar and tongue",
    ],
    isNew: true,
    reviews: [
      {
        author: "Cole D.",
        rating: 5,
        title: "Grippy and comfy",
        body: "Look great with cargos. The lug sole actually grips wet pavement.",
        verified: true,
        daysAgo: 13,
      },
    ],
  },
];
