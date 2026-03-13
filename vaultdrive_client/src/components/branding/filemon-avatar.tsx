import filemonAvatar from "../../assets/filemon-avatar.png";

interface FilemonAvatarProps {
  className?: string;
  alt?: string;
}

export default function FilemonAvatar({ className = "w-8 h-8 rounded-full", alt = "Filemon Prime" }: FilemonAvatarProps) {
  return <img src={filemonAvatar} alt={alt} className={className} />;
}