import { Badge } from "@/components/ui/badge";
import type { MessageStatus, RequestStatus, ReviewStatus, UserStatus } from "@/lib/db";
import {
  displayStatus,
  MESSAGE_STATUS_LABEL,
  MESSAGE_STATUS_VARIANT,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_VARIANT,
  REVIEW_STATUS_LABEL,
  USER_STATUS_LABEL,
} from "@/lib/status";

export function RequestStatusBadge({ status, overdue, className }: { status: RequestStatus; overdue: boolean; className?: string }) {
  const s = displayStatus(status, overdue);
  return (
    <Badge variant={REQUEST_STATUS_VARIANT[s]} className={className}>
      {REQUEST_STATUS_LABEL[s]}
    </Badge>
  );
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const variant = status === "APPROVED" ? "approved" : status === "CHANGES_REQUESTED" ? "changes" : "uploaded";
  return <Badge variant={variant}>{REVIEW_STATUS_LABEL[status]}</Badge>;
}

export function MessageStatusBadge({ status, simulated }: { status: MessageStatus; simulated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={MESSAGE_STATUS_VARIANT[status]}>{MESSAGE_STATUS_LABEL[status]}</Badge>
      {simulated ? <Badge variant="outline" className="text-[10px] text-muted-foreground">Simulated</Badge> : null}
    </span>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const variant = status === "ACTIVE" ? "approved" : status === "INVITED" ? "uploaded" : "cancelled";
  return <Badge variant={variant}>{USER_STATUS_LABEL[status]}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "approved" : "pending"}>{active ? "Active" : "Inactive"}</Badge>;
}
