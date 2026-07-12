import { createContext, useContext, useState, type ReactNode } from "react";

export interface TimeWindowOption {
  days: number;
  label: string;
  short: string;
}

export const TIME_WINDOWS: TimeWindowOption[] = [
  { days: 7, label: "últimos 7 dias", short: "7d" },
  { days: 30, label: "últimos 30 dias", short: "30d" },
  { days: 90, label: "últimos 90 dias", short: "90d" },
  { days: 365, label: "último ano", short: "1a" },
];

interface TimeWindowCtx {
  days: number;
  setDays: (days: number) => void;
  option: TimeWindowOption;
}

const Ctx = createContext<TimeWindowCtx | null>(null);

export function TimeWindowProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState(7);
  const option =
    TIME_WINDOWS.find((w) => w.days === days) ?? TIME_WINDOWS[0];
  return (
    <Ctx.Provider value={{ days, setDays, option }}>{children}</Ctx.Provider>
  );
}

export function useTimeWindow(): TimeWindowCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useTimeWindow must be used within TimeWindowProvider");
  }
  return ctx;
}
