interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function Avatar({ name, color, size = 32 }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center justify-center rounded-full text-xs font-medium text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
