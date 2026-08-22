export const staffTypes = ["teacher", "non_teaching"] as const;
export type StaffType = (typeof staffTypes)[number];
export const staffTypeLabels: Record<StaffType, string> = { teacher: "Teacher", non_teaching: "Non-teaching" };
export const employmentStatuses = ["active", "inactive"] as const;
export type EmploymentStatus = (typeof employmentStatuses)[number];
export const employmentStatusLabels: Record<EmploymentStatus, string> = { active: "Active", inactive: "Inactive" };
