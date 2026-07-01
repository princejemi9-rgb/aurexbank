export type SavedBiller = {
  id: string;
  name: string;
  category: string;
  accountEnding: string;
};

export type ScheduledBillPayment = {
  id: string;
  biller: string;
  amount: number;
  date: string;
  frequency: string;
  accountEnding: string;
  status: "Active" | "Paused";
};

export type BillPayPreferences = {
  savedBillers: SavedBiller[];
  scheduledPayments: ScheduledBillPayment[];
};

const BILL_PAY_KEY = "aurex-bill-pay";
const BILL_PAY_EVENT = "aurex:bill-pay";

const DEFAULT_PREFERENCES: BillPayPreferences = {
  savedBillers: [
    {
      id: "saved-con-edison",
      name: "Con Edison",
      category: "Utilities",
      accountEnding: "2298",
    },
    {
      id: "saved-att",
      name: "AT&T Wireless",
      category: "Mobile & Internet",
      accountEnding: "7401",
    },
    {
      id: "saved-netflix",
      name: "Netflix",
      category: "Entertainment",
      accountEnding: "1186",
    },
  ],
  scheduledPayments: [
    {
      id: "scheduled-mortgage",
      biller: "Aurex Mortgage",
      amount: 6850,
      date: "2026-07-05",
      frequency: "Monthly",
      accountEnding: "9024",
      status: "Active",
    },
    {
      id: "scheduled-water",
      biller: "NYC Water Board",
      amount: 420,
      date: "2026-07-11",
      frequency: "Once",
      accountEnding: "4417",
      status: "Active",
    },
  ],
};

let cachedPreferences: BillPayPreferences | null = null;

function copyDefaults(): BillPayPreferences {
  return {
    savedBillers: DEFAULT_PREFERENCES.savedBillers.map((biller) => ({ ...biller })),
    scheduledPayments: DEFAULT_PREFERENCES.scheduledPayments.map((payment) => ({
      ...payment,
    })),
  };
}

function isSavedBiller(value: unknown): value is SavedBiller {
  if (!value || typeof value !== "object") return false;
  const biller = value as Partial<SavedBiller>;

  return Boolean(
    biller.id &&
      biller.name &&
      biller.category &&
      typeof biller.accountEnding === "string"
  );
}

function isScheduledPayment(value: unknown): value is ScheduledBillPayment {
  if (!value || typeof value !== "object") return false;
  const payment = value as Partial<ScheduledBillPayment>;

  return Boolean(
    payment.id &&
      payment.biller &&
      Number.isFinite(payment.amount) &&
      payment.date &&
      payment.frequency &&
      typeof payment.accountEnding === "string" &&
      (payment.status === "Active" || payment.status === "Paused")
  );
}

export function loadBillPayPreferences(): BillPayPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  if (cachedPreferences) return cachedPreferences;

  try {
    const raw = window.localStorage.getItem(BILL_PAY_KEY);
    if (!raw) {
      cachedPreferences = copyDefaults();
      return cachedPreferences;
    }

    const parsed = JSON.parse(raw) as Partial<BillPayPreferences>;
    cachedPreferences = {
      savedBillers: Array.isArray(parsed.savedBillers)
        ? parsed.savedBillers.filter(isSavedBiller)
        : copyDefaults().savedBillers,
      scheduledPayments: Array.isArray(parsed.scheduledPayments)
        ? parsed.scheduledPayments.filter(isScheduledPayment)
        : copyDefaults().scheduledPayments,
    };

    return cachedPreferences;
  } catch {
    cachedPreferences = copyDefaults();
    return cachedPreferences;
  }
}

export function saveBillPayPreferences(preferences: BillPayPreferences) {
  if (typeof window === "undefined") return;

  cachedPreferences = {
    savedBillers: preferences.savedBillers.map((biller) => ({ ...biller })),
    scheduledPayments: preferences.scheduledPayments.map((payment) => ({
      ...payment,
    })),
  };
  window.localStorage.setItem(BILL_PAY_KEY, JSON.stringify(cachedPreferences));
  window.dispatchEvent(new Event(BILL_PAY_EVENT));
}

export function subscribeBillPayPreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  function handleStorage(event: StorageEvent) {
    if (!event.key || event.key === BILL_PAY_KEY) {
      cachedPreferences = null;
      onStoreChange();
    }
  }

  window.addEventListener(BILL_PAY_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(BILL_PAY_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getBillPayPreferencesSnapshot() {
  return loadBillPayPreferences();
}

export function getBillPayPreferencesServerSnapshot() {
  return DEFAULT_PREFERENCES;
}
