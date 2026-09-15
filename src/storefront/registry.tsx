import type { ThemeId } from "@/themes/types";
import type { StorefrontComponents } from "./types";

import { NoirCard } from "./themes/noir/card";
import { NoirFooter } from "./themes/noir/footer";
import { NoirHome } from "./themes/noir/home";
import { NoirPdp } from "./themes/noir/pdp";
import { NoirShop } from "./themes/noir/shop";

import { ConcreteCard } from "./themes/concrete/card";
import { ConcreteFooter } from "./themes/concrete/footer";
import { ConcreteHome } from "./themes/concrete/home";
import { ConcretePdp } from "./themes/concrete/pdp";
import { ConcreteShop } from "./themes/concrete/shop";

import { DistrictCard } from "./themes/district/card";
import { DistrictFooter } from "./themes/district/footer";
import { DistrictHome } from "./themes/district/home";
import { DistrictPdp } from "./themes/district/pdp";
import { DistrictShop } from "./themes/district/shop";

import { NightshiftCard } from "./themes/nightshift/card";
import { NightshiftFooter } from "./themes/nightshift/footer";
import { NightshiftHome } from "./themes/nightshift/home";
import { NightshiftPdp } from "./themes/nightshift/pdp";
import { NightshiftShop } from "./themes/nightshift/shop";

import { ArchiveCard } from "./themes/archive/card";
import { ArchiveFooter } from "./themes/archive/footer";
import { ArchiveHome } from "./themes/archive/home";
import { ArchivePdp } from "./themes/archive/pdp";
import { ArchiveShop } from "./themes/archive/shop";

import { SignatureCard } from "./themes/signature/card";
import { SignatureFooter } from "./themes/signature/footer";
import { SignatureHome } from "./themes/signature/home";
import { SignaturePdp } from "./themes/signature/pdp";
import { SignatureShop } from "./themes/signature/shop";

import { SeventhCard } from "./themes/seventh/card";
import { SeventhFooter } from "./themes/seventh/footer";
import { SeventhHome } from "./themes/seventh/home";
import { SeventhPdp } from "./themes/seventh/pdp";
import { SeventhShop } from "./themes/seventh/shop";

/**
 * Storefront registry — every theme provides a COMPLETE storefront surface
 * (Home / Shop / PDP / Footer / Card). Pages resolve the active theme and
 * render exactly one of these sets; the other five never enter the
 * server-rendered tree, so their client modules are never streamed or
 * downloaded by customers.
 *
 * All seven consume the SAME data loaders, business components and APIs —
 * nothing below the presentation layer knows a theme exists.
 */
const STOREFRONTS: Record<ThemeId, StorefrontComponents> = {
  noir: {
    Home: NoirHome,
    Shop: NoirShop,
    Pdp: NoirPdp,
    FooterView: NoirFooter,
    Card: NoirCard,
  },
  concrete: {
    Home: ConcreteHome,
    Shop: ConcreteShop,
    Pdp: ConcretePdp,
    FooterView: ConcreteFooter,
    Card: ConcreteCard,
  },
  district: {
    Home: DistrictHome,
    Shop: DistrictShop,
    Pdp: DistrictPdp,
    FooterView: DistrictFooter,
    Card: DistrictCard,
  },
  nightshift: {
    Home: NightshiftHome,
    Shop: NightshiftShop,
    Pdp: NightshiftPdp,
    FooterView: NightshiftFooter,
    Card: NightshiftCard,
  },
  archive: {
    Home: ArchiveHome,
    Shop: ArchiveShop,
    Pdp: ArchivePdp,
    FooterView: ArchiveFooter,
    Card: ArchiveCard,
  },
  signature: {
    Home: SignatureHome,
    Shop: SignatureShop,
    Pdp: SignaturePdp,
    FooterView: SignatureFooter,
    Card: SignatureCard,
  },
  seventh: {
    Home: SeventhHome,
    Shop: SeventhShop,
    Pdp: SeventhPdp,
    FooterView: SeventhFooter,
    Card: SeventhCard,
  },
};

export function getStorefront(id: ThemeId): StorefrontComponents {
  return STOREFRONTS[id] ?? STOREFRONTS.district;
}
