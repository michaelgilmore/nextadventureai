export type ParsedJobLink = {
  canonicalUrl: string;
  linkedinJobId: string | null;
  isLinkedIn: boolean;
};

/**
 * Normalizes a job link so the same posting shared in different ways
 * (tracking params, /jobs/view/... vs ?currentJobId=...) is recognized as one job.
 */
export function parseJobLink(raw: string): ParsedJobLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const isLinkedIn = host.endsWith("linkedin.com");

  let jobId: string | null = null;
  if (isLinkedIn) {
    const fromPath = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/);
    const fromCollection = url.pathname.match(/\/jobs\/collections\/[^/]*\/?(\d{6,})?/);
    jobId =
      fromPath?.[1] ??
      url.searchParams.get("currentJobId") ??
      url.searchParams.get("refId&currentJobId") ??
      fromCollection?.[1] ??
      null;
    if (jobId) jobId = jobId.replace(/\D/g, "") || null;
  }

  const canonicalUrl =
    isLinkedIn && jobId
      ? `https://www.linkedin.com/jobs/view/${jobId}/`
      : `${url.origin}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();

  return { canonicalUrl, linkedinJobId: jobId, isLinkedIn };
}
