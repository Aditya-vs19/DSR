const TEAM_LABEL_MAP = {
  Finance: "Accounts&Finance"
};

export const toTeamLabel = (team) => {
  const value = String(team ?? "").trim();
  if (!value) {
    return "";
  }

  return TEAM_LABEL_MAP[value] || value;
};
