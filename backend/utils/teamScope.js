const SALES_TEAM = "Sales";
const LOGISTICS_TEAM = "Logistics";
const DUAL_TEAM_ADMIN_NAME = "snigdha";

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
