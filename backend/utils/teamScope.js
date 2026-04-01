const SALES_TEAM = "Sales";
const LOGISTICS_TEAM = "Logistics";
const OPERATIONS_TEAM = "Operations";
const TECHNICAL_TEAM = "Technical";
const FINANCE_TEAM = "Finance";
const DUAL_TEAM_ADMIN_NAME = "snigdha";

export const TASK_DEPARTMENTS = [SALES_TEAM, LOGISTICS_TEAM, OPERATIONS_TEAM, TECHNICAL_TEAM, FINANCE_TEAM];

const normalizeText = (value) => String(value || "").trim().toLowerCase();

export const getManagedTeamsForAdmin = (user) => {
  const userTeam = String(user?.team || "").trim();

  if (user?.role !== "admin") {
    return userTeam ? [userTeam] : [];
  }

  if (userTeam === LOGISTICS_TEAM) {
    return [SALES_TEAM, LOGISTICS_TEAM];
  }

  if (userTeam === SALES_TEAM && normalizeText(user?.name) === DUAL_TEAM_ADMIN_NAME) {
    return [SALES_TEAM, LOGISTICS_TEAM];
  }

  return userTeam ? [userTeam] : [];
};

export const isTeamManagedByAdmin = (user, targetTeam) => {
  const managedTeams = getManagedTeamsForAdmin(user);
  return managedTeams.includes(String(targetTeam || "").trim());
};
