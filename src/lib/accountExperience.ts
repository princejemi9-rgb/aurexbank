type AccountExperience = {
  historyStart: string;
  historyEnd: string;
  storedMetrics: boolean;
  previewCard: boolean;
};

const configuredAccounts: Record<string, AccountExperience> = {
  "dudbryan54@gmail.com": {
    historyStart: "2021-03-01T00:00:00.000Z",
    historyEnd: "2026-02-28T23:59:59.999Z",
    storedMetrics: true,
    previewCard: true,
  },
};

const legacyExperience: AccountExperience = {
  historyStart: "2022-01-01T00:00:00.000Z",
  historyEnd: "2026-09-30T23:59:59.999Z",
  storedMetrics: false,
  previewCard: false,
};

export function getAccountExperience(email: string): AccountExperience {
  return configuredAccounts[email.trim().toLowerCase()] ?? legacyExperience;
}
