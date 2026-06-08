import { branding } from "../../config/branding";
import ABRNLogo from "./abrn-logo";
import QuantixLogo from "./quantix-logo";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Brand logo switcher — ABRN overlay.
 *
 * This file is part of the ABRN downstream overlay on top of the QuantiX Drive
 * upstream. It replaces the upstream brand-logo.tsx (which renders only
 * QuantixLogo) with a switcher that picks ABRNLogo when VITE_LOGO_VARIANT=abrn.
 *
 * When syncing upstream, this file will conflict with upstream/main's
 * brand-logo.tsx — resolve by keeping this switcher version and discarding
 * the upstream rewrite.
 */
export default function BrandLogo({ className, alt }: BrandLogoProps) {
  const label = alt ?? branding.productName;
  if (branding.logoVariant === "abrn") {
    return <ABRNLogo className={className} alt={label} />;
  }
  return <QuantixLogo className={className} alt={label} />;
}
