import { branding, getCopyrightLine } from "../../config/branding";
import BrandLogo from "./brand-logo";
import PoweredByBadge from "./powered-by-badge";

export default function LandingPageFooter() {
  const radialGradient = `radial-gradient(ellipse at 50% 100%, ${branding.primaryColor}14 0%, transparent 70%)`;

  return (
    <footer className="brand-footer relative overflow-hidden">
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: radialGradient,
          pointerEvents: "none",
        }}
      />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="flex flex-col items-center justify-center mb-8">
          <BrandLogo className="w-16 h-16 mb-4" alt={branding.companyName} />
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-foreground">
              {branding.companyName}
            </h3>
            <p className="text-muted-foreground text-sm">
              {branding.landingTagline}
            </p>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold brand-gradient-text mb-2">
            {branding.landingTagline}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enterprise-grade encrypted cloud storage designed and developed for
            the secure needs of {branding.companyName}
          </p>
        </div>

        <div className="flex justify-center">
          <PoweredByBadge className="flex items-center gap-2 text-muted-foreground" />
        </div>
      </div>

      <div
        className="border-t py-4"
        style={{ borderColor: `${branding.primaryColor}33` }}
      >
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">{getCopyrightLine()}</p>
        </div>
      </div>
    </footer>
  );
}
