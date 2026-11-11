import Link from "next/link";
import {
  Baby,
  BookOpen,
  Briefcase,
  Camera,
  Car,
  ChefHat,
  Dumbbell,
  Gamepad2,
  Gem,
  Gift,
  Guitar,
  Headphones,
  HeartPulse,
  Laptop,
  LayoutGrid,
  Leaf,
  Luggage,
  Package,
  PawPrint,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tent,
  Tv,
  Watch,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Keyword → icon, first match wins. Categories come from the database; only the icon is mapped. */
const ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/phone|mobile|tablet/, Smartphone],
  [/laptop|computer|pc\b/, Laptop],
  [/audio|headphone|sound|speaker/, Headphones],
  [/tv|television/, Tv],
  [/camera|photo/, Camera],
  [/gaming|game|console/, Gamepad2],
  [/watch|wearable/, Watch],
  [/fashion|cloth|apparel|wear|shirt|shoe/, Shirt],
  [/beauty|cosmetic|skin|fragrance|perfume/, Sparkles],
  [/jewel/, Gem],
  [/kitchen|cook|dining/, ChefHat],
  [/home|furniture|living|decor|lifestyle/, Sofa],
  [/sport|fitness|gym|exercise/, Dumbbell],
  [/outdoor|camp|hiking/, Tent],
  [/travel|luggage|bag/, Luggage],
  [/work|office|productivity|stationery/, Briefcase],
  [/music|instrument|guitar/, Guitar],
  [/health|wellness|medical/, HeartPulse],
  [/baby|kid|toy/, Baby],
  [/pet/, PawPrint],
  [/book/, BookOpen],
  [/car|auto|motor/, Car],
  [/tool|hardware|diy/, Wrench],
  [/garden|plant/, Leaf],
  [/grocery|food/, ShoppingBasket],
  [/gift/, Gift],
  [/electronic|gadget|tech/, Smartphone],
];

export function categoryIcon(slug: string): LucideIcon {
  return ICON_RULES.find(([re]) => re.test(slug))?.[1] ?? Package;
}

const tileClass =
  "group flex w-[76px] md:w-[88px] flex-none snap-start flex-col items-center gap-2 text-center focus-visible:outline-offset-4 rounded-2xl";
const iconBoxClass =
  "flex size-14 md:size-16 items-center justify-center rounded-2xl border border-line bg-white text-ink transition-colors group-hover:border-ink";

/** Top row of category tiles (real active categories) plus an "All" tile. Scrolls sideways on small screens. */
export function HomeCategoryRow({ categories }: { categories: Array<{ id: string; slug: string; name: string }> }) {
  return (
    <nav aria-label="Shop by category">
      <ul className="flex gap-2 md:gap-3 overflow-x-auto no-scrollbar snap-x -mx-5 px-5 md:mx-0 md:px-0 pb-1">
        <li className="flex-none">
          <Link href="/products" className={tileClass}>
            <span className={`${iconBoxClass} bg-ink border-ink text-volt group-hover:border-ink`}>
              <LayoutGrid size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="text-[12px] font-medium leading-tight text-ink">All</span>
          </Link>
        </li>
        {categories.map((c) => {
          const Icon = categoryIcon(c.slug);
          return (
            <li key={c.id} className="flex-none">
              <Link href={`/categories/${c.slug}`} className={tileClass}>
                <span className={iconBoxClass}>
                  <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="text-[12px] font-medium leading-tight text-ink line-clamp-2">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
