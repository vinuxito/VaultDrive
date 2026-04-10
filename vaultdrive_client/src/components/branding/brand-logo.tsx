import { branding } from "../../config/branding";
import QuantixLogo from "./quantix-logo";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Brand logo — renders the QuantiX logo by default.
 *
 * Branded downstream deployments can replace this file in their overlay
 * to render an alternate logo based on `branding.logoVariant`.
 */
export default function BrandLogo({ className, alt }: BrandLogoProps) {
  const label = alt ?? branding.productName;
  return <QuantixLogo className={className} alt={label} />;
}
