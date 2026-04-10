import { branding } from "../../config/branding";
import ABRNLogo from "./abrn-logo";
import QuantixLogo from "./quantix-logo";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Brand logo switcher — renders the logo variant selected in the branding
 * config. Use this instead of importing a specific logo directly.
 */
export default function BrandLogo({ className, alt }: BrandLogoProps) {
  const label = alt ?? branding.productName;
  if (branding.logoVariant === "abrn") {
    return <ABRNLogo className={className} alt={label} />;
  }
  return <QuantixLogo className={className} alt={label} />;
}
