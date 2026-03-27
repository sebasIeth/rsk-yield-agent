export function formatAPY(value: number): string {
  return value.toFixed(1) + "%";
}

export function formatBalance(value: number, decimals: number = 6): string {
  return value.toFixed(decimals);
}

export function formatTVL(value: number): string {
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(0) + "K";
  return "$" + value.toFixed(0);
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (hours < 1) return "Just now";
  if (hours < 24) return hours + "h ago";
  if (hours < 48) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
