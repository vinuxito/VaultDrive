import ABRNLogo from "./abrn-logo";
import PoweredByBadge from "./powered-by-badge";

export default function LandingPageFooter() {
  return (
    <footer className="abrn-footer relative overflow-hidden">
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%, rgba(125,79,80,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="flex flex-col items-center justify-center mb-8">
          <ABRNLogo className="w-16 h-16 mb-4" alt="ABRN Asesores" />
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-foreground">ABRN Asesores</h3>
            <p className="text-muted-foreground text-sm">Coded for Excellence</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold abrn-gradient-text mb-2">
            Coded for ABRN Asesores
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enterprise-grade encrypted cloud storage designed and developed for
            the secure needs of ABRN Asesores
          </p>
        </div>

        <div className="flex justify-center">
          <PoweredByBadge className="flex items-center gap-2 text-muted-foreground" />
        </div>
      </div>

      <div className="border-t border-[#7d4f50]/20 py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ABRN Asesores. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}