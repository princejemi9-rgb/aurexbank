"use client";

import AppIcon from "./AppIcon";
import { useBalancePrivacy } from "../../context/BalancePrivacyContext";

type PrivateAmountProps = {
  value: number | string;
  className?: string;
  currency?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  prefix?: string;
  suffix?: string;
};

type BalancePrivacyToggleProps = {
  className?: string;
  iconClassName?: string;
};

const MASK = "******";
const MONEY_TEXT_PATTERN = /\$[\d,]+(?:\.\d{1,2})?[KMB]?/gi;

function formatNumericValue(
  value: number,
  minimumFractionDigits: number,
  maximumFractionDigits: number
) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
    minimumFractionDigits,
  });
}

export function PrivateAmount({
  value,
  className,
  currency = "$",
  maximumFractionDigits = 2,
  minimumFractionDigits = 2,
  prefix,
  suffix = "",
}: PrivateAmountProps) {
  const { balancesHidden } = useBalancePrivacy();
  const leading = prefix ?? currency;
  const visible =
    typeof value === "number"
      ? `${leading}${formatNumericValue(
          value,
          minimumFractionDigits,
          maximumFractionDigits
        )}${suffix}`
      : `${leading}${value}${suffix}`;

  return (
    <span className={className} aria-label={balancesHidden ? "Amount hidden" : undefined}>
      {balancesHidden ? `${leading}${MASK}${suffix}` : visible}
    </span>
  );
}

export function BalancePrivacyToggle({
  className = "bank-button flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300",
  iconClassName = "h-5 w-5",
}: BalancePrivacyToggleProps) {
  const { balancesHidden, toggleBalancesHidden } = useBalancePrivacy();

  return (
    <button
      type="button"
      aria-label={balancesHidden ? "Show balances" : "Hide balances"}
      title={balancesHidden ? "Show balances" : "Hide balances"}
      onClick={(event) => {
        event.stopPropagation();
        toggleBalancesHidden();
      }}
      className={className}
    >
      <AppIcon name={balancesHidden ? "eyeOff" : "eye"} className={iconClassName} />
    </button>
  );
}

export function PrivateMoneyText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { balancesHidden } = useBalancePrivacy();
  const displayText = balancesHidden ? text.replace(MONEY_TEXT_PATTERN, `$${MASK}`) : text;

  return <span className={className}>{displayText}</span>;
}
