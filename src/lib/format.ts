const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type DateFormat = "dd-mmm-yyyy" | "mmm-dd-yyyy" | "iso";

export const dateFormats: { id: DateFormat; label: string }[] = [
  { id: "dd-mmm-yyyy", label: "DD MMM YYYY" },
  { id: "mmm-dd-yyyy", label: "MMM DD, YYYY" },
  { id: "iso", label: "YYYY-MM-DD" },
];

/** "2026-10-06" → "06 Oct 2026" (or the chosen format). Parsed by hand so the result never shifts with timezone. */
export function formatDate(iso: string, format: DateFormat = "dd-mmm-yyyy") {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = String(d).padStart(2, "0");
  if (format === "iso") return `${y}-${String(m).padStart(2, "0")}-${dd}`;
  if (format === "mmm-dd-yyyy") return `${months[m - 1]} ${dd}, ${y}`;
  return `${dd} ${months[m - 1]} ${y}`;
}

/** The demo's fixed "today", so overdue treatment is stable. */
export const DEMO_TODAY = "2026-10-06";

export type DueState = "overdue" | "today" | "upcoming";

export function dueState(iso: string): DueState {
  if (iso < DEMO_TODAY) return "overdue";
  if (iso === DEMO_TODAY) return "today";
  return "upcoming";
}
