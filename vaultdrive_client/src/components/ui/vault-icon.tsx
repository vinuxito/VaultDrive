import vaultSvg from "../../assets/vault.svg";

interface VaultIconProps {
  className?: string;
}

export default function VaultIcon({ className = "w-8 h-8" }: VaultIconProps) {
  return <img src={vaultSvg} alt="VaultDrive" className={className} />;
}
