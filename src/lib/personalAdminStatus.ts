export type PersonalAdminStatus = "pending_approval" | "approved" | "rejected" | "suspended";

const labels: Record<PersonalAdminStatus, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
};

export function personalAdminStatusLabel(status?: string) {
  return status && status in labels ? labels[status as PersonalAdminStatus] : "Status unavailable";
}

export function personalAdminStatusMessage(status?: string) {
  switch (status) {
    case "pending_approval": return "Your Personal Admin registration is awaiting Super Admin approval. Customer data is unavailable until then.";
    case "rejected": return "Your Personal Admin registration was not approved. Contact a Super Admin for assistance.";
    case "suspended": return "Your Personal Admin access is suspended. Contact a Super Admin for assistance.";
    default: return "Your Personal Admin status is being checked. Customer data is unavailable until approval is confirmed.";
  }
}
