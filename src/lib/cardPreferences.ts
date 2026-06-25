export type CardPreferences = {
  frozenCards: string[];
  onlineEnabled: boolean;
  contactlessEnabled: boolean;
  travelMode: boolean;
  cardPurchaseLimit: number;
  atmLimit: number;
};

export const CARD_PREFERENCES_EVENT = "aurex:card-preferences";

const CARD_PREFERENCES_KEY = "aurex-card-preferences";
const DEFAULT_CARD_PREFERENCES: CardPreferences = {
  frozenCards: [],
  onlineEnabled: true,
  contactlessEnabled: true,
  travelMode: false,
  cardPurchaseLimit: 25000,
  atmLimit: 4000,
};

let cachedPreferences: CardPreferences | null = null;

export function createDefaultCardPreferences(): CardPreferences {
  return {
    ...DEFAULT_CARD_PREFERENCES,
    frozenCards: [...DEFAULT_CARD_PREFERENCES.frozenCards],
  };
}

export function loadCardPreferences(): CardPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_CARD_PREFERENCES;
  }

  if (cachedPreferences) {
    return cachedPreferences;
  }

  try {
    const rawPreferences = window.localStorage.getItem(CARD_PREFERENCES_KEY);
    if (!rawPreferences) {
      cachedPreferences = createDefaultCardPreferences();
      return cachedPreferences;
    }

    const parsed = JSON.parse(rawPreferences) as Partial<CardPreferences>;
    const defaults = createDefaultCardPreferences();

    cachedPreferences = {
      frozenCards: Array.isArray(parsed.frozenCards)
        ? parsed.frozenCards.filter((cardId): cardId is string => typeof cardId === "string")
        : defaults.frozenCards,
      onlineEnabled:
        typeof parsed.onlineEnabled === "boolean" ? parsed.onlineEnabled : defaults.onlineEnabled,
      contactlessEnabled:
        typeof parsed.contactlessEnabled === "boolean"
          ? parsed.contactlessEnabled
          : defaults.contactlessEnabled,
      travelMode: typeof parsed.travelMode === "boolean" ? parsed.travelMode : defaults.travelMode,
      cardPurchaseLimit:
        typeof parsed.cardPurchaseLimit === "number"
          ? parsed.cardPurchaseLimit
          : defaults.cardPurchaseLimit,
      atmLimit: typeof parsed.atmLimit === "number" ? parsed.atmLimit : defaults.atmLimit,
    };

    return cachedPreferences;
  } catch {
    cachedPreferences = createDefaultCardPreferences();
    return cachedPreferences;
  }
}

export function saveCardPreferences(preferences: CardPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  cachedPreferences = {
    ...preferences,
    frozenCards: [...preferences.frozenCards],
  };

  window.localStorage.setItem(CARD_PREFERENCES_KEY, JSON.stringify(cachedPreferences));
  window.dispatchEvent(
    new CustomEvent<CardPreferences>(CARD_PREFERENCES_EVENT, { detail: cachedPreferences })
  );
}

export function subscribeCardPreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorage(event: StorageEvent) {
    if (!event.key || event.key === CARD_PREFERENCES_KEY) {
      cachedPreferences = null;
      onStoreChange();
    }
  }

  window.addEventListener(CARD_PREFERENCES_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CARD_PREFERENCES_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getCardPreferencesSnapshot() {
  return loadCardPreferences();
}

export function getCardPreferencesServerSnapshot() {
  return DEFAULT_CARD_PREFERENCES;
}
