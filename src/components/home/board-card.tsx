import Link from "next/link";

interface BoardCardProps {
  id: string;
  title: string;
  updatedAt: string;
}

export function BoardCard({ id, title, updatedAt }: BoardCardProps) {
  return (
    <Link
      href={`/board/${id}`}
      className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-8 h-28 rounded-lg bg-gray-100" />
      <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
        {title}
      </h3>
      <p className="mt-1 text-xs text-gray-400">
        Updated {new Date(updatedAt).toLocaleDateString()}
      </p>
    </Link>
  );
}
