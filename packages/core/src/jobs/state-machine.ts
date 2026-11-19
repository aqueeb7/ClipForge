import { JobStatus, ClipForgeError, ErrorCode } from "@clipforge/shared";

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["queued"], // Allow retrying failed jobs
  cancelled: ["queued"] // Allow restarting cancelled jobs
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed.includes(to);
}

export function validateJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new ClipForgeError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: `Invalid job state transition from '${from}' to '${to}'.`,
      diagnosticContext: { from, to }
    });
  }
}
