import { cn } from "@/lib/utils";

export type JobSort = "newest" | "score" | "location" | "title" | "company";

export const JOB_SORT_OPTIONS: { value: JobSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "score", label: "Score" },
  { value: "location", label: "Location" },
  { value: "title", label: "Job title" },
  { value: "company", label: "Company" },
];

type SortableJob = {
  match_score: number | null;
  location: string | null;
  title: string | null;
  company: string | null;
  created_at: string;
};

function lastValue<T extends string | number>(value: T | null | undefined): T | null {
  return value ?? null;
}

export function sortJobs<T extends SortableJob>(jobs: T[], sort: JobSort): T[] {
  const sorted = [...jobs];
  switch (sort) {
    case "score":
      sorted.sort((a, b) => {
        const scoreA = lastValue(a.match_score);
        const scoreB = lastValue(b.match_score);
        // Highest score first; unscored jobs sink to the bottom.
        if (scoreA === null && scoreB === null) return 0;
        if (scoreA === null) return 1;
        if (scoreB === null) return -1;
        return scoreB - scoreA;
      });
      break;
    case "location":
      sorted.sort((a, b) => {
        const locA = lastValue(a.location);
        const locB = lastValue(b.location);
        if (locA === null && locB === null) return 0;
        if (locA === null) return 1;
        if (locB === null) return -1;
        return locA.localeCompare(locB);
      });
      break;
    case "title":
      sorted.sort((a, b) => {
        const titleA = lastValue(a.title);
        const titleB = lastValue(b.title);
        if (titleA === null && titleB === null) return 0;
        if (titleA === null) return 1;
        if (titleB === null) return -1;
        return titleA.localeCompare(titleB);
      });
      break;
    case "company":
      sorted.sort((a, b) => {
        const companyA = lastValue(a.company);
        const companyB = lastValue(b.company);
        if (companyA === null && companyB === null) return 0;
        if (companyA === null) return 1;
        if (companyB === null) return -1;
        return companyA.localeCompare(companyB);
      });
      break;
    default:
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return sorted;
}

export function JobSortSelect({
  value,
  onChange,
  className,
}: {
  value: JobSort;
  onChange: (value: JobSort) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      Sort by
      <select
        className="rounded-md border border-input bg-secondary px-2 py-1 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value as JobSort)}
      >
        {JOB_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
