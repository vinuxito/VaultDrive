import type { Skin } from "../components/theme-provider";

export function getDefaultSkinForProduct(productSlug: string): Skin {
  return productSlug === "abrn-drive" ? "light" : "quantix";
}

export function getSkinStorageKey(productSlug: string): string {
  return productSlug === "quantix-drive" ? "quantixdrive-skin" : `${productSlug}-skin`;
}
