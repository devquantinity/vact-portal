import type { JobStatus, MessageStatus, RequestStatus, ReviewStatus, UserStatus } from "@/lib/db";

export type RequestDisplayStatus = RequestStatus | "OVERDUE";

/** Overdue is computed, never stored: PENDING and due before today (Kuala Lumpur). */
export function displayStatus(status: RequestStatus, overdue: boolean): RequestDisplayStatus {
  return status === "PENDING" && overdue ? "OVERDUE" : status;
}

export const REQUEST_STATUS_LABEL: Record<RequestDisplayStatus, string> = {
  PENDING: "Pending",
  OVERDUE: "Overdue",
  UPLOADED: "Awaiting review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

export const REQUEST_STATUS_VARIANT: Record<RequestDisplayStatus, "pending" | "overdue" | "uploaded" | "changes" | "approved" | "cancelled"> = {
  PENDING: "pending",
  OVERDUE: "overdue",
  UPLOADED: "uploaded",
  CHANGES_REQUESTED: "changes",
  APPROVED: "approved",
  CANCELLED: "cancelled",
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  AWAITING: "Awaiting review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  QUEUED: "Queued",
  SENT: "Sent",
  DELIVERED: "Delivered",
  READ: "Read",
  FAILED: "Failed",
};

export const MESSAGE_STATUS_VARIANT: Record<MessageStatus, "pending" | "info" | "uploaded" | "approved" | "overdue"> = {
  QUEUED: "pending",
  SENT: "info",
  DELIVERED: "uploaded",
  READ: "approved",
  FAILED: "overdue",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  SKIPPED: "Skipped",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  DISABLED: "Disabled",
};

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  INVITE: "Invitation",
  PASSWORD_RESET: "Password reset",
  NEW_REQUEST: "New request",
  REMINDER: "Reminder",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  ESCALATION: "Escalation",
  UPLOAD_RECEIVED: "Upload received",
  TEST: "Test message",
};

export const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  BOTH: "WhatsApp + email",
};
