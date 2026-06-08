import abrnLogo from "../../assets/abrn-logo.png";

interface ABRNLogoProps {
  className?: string;
  alt?: string;
}

export default function ABRNLogo({ className = "h-10", alt = "ABRN Asesores" }: ABRNLogoProps) {
  return <img src={abrnLogo} alt={alt} className={className} />;
}