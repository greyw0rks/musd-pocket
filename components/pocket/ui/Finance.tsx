"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function TokenBadge({ symbol }: { symbol: string }) {
  return (
    <span className="pk-token">
      <span
        className={`pk-token-disc ${symbol === "BTC" ? "pk-token-disc--btc" : ""}`}
        aria-hidden="true"
      >
        {symbol === "BTC"
          ? "₿"
          : symbol === "LP"
            ? "≋"
            : symbol === "MEZO"
              ? "M"
              : "$"}
      </span>
      {symbol}
    </span>
  );
}

export function AmountField({
  label,
  symbol,
  hint,
  error,
  onMax,
  maxLabel = "Max",
  ...props
}: {
  label: string;
  symbol: string;
  hint?: ReactNode;
  error?: string;
  onMax?: () => void;
  maxLabel?: string;
} & Omit<ComponentProps<"input">, "className">) {
  const id = useId();
  return (
    <div className="pk-amount-field" data-invalid={Boolean(error) || undefined}>
      <div className="pk-amount-label">
        <label htmlFor={id}>{label}</label>
        {onMax ? (
          <button
            type="button"
            className="pk-max"
            disabled={props.disabled}
            onClick={onMax}
          >
            {maxLabel}
          </button>
        ) : null}
      </div>
      <div className="pk-amount-entry">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          {...props}
        />
        <TokenBadge symbol={symbol} />
      </div>
      <p id={`${id}-hint`} className="pk-amount-hint">
        {error ?? hint}
      </p>
    </div>
  );
}

export function FinanceTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pk-finance-tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FinanceSelect({
  label,
  children,
  ...props
}: { label: string } & ComponentProps<"select">) {
  const id = useId();
  return (
    <div className="pk-finance-select">
      <label htmlFor={id}>{label}</label>
      <div>
        <select id={id} {...props}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </div>
  );
}

export function SlippageControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <FinanceSelect
      label="Slippage tolerance"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      <option value={10}>0.1%</option>
      <option value={50}>0.5%</option>
      <option value={100}>1%</option>
    </FinanceSelect>
  );
}

export function FinanceIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="pk-finance-intro">
      <h2>{title}</h2>
      <p className="pk-m">{children}</p>
    </div>
  );
}
