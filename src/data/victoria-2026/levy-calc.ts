import levy from "./levy.json";

export type LevyClass = "residential" | "primary";

export interface LevyVersion {
  id: string;
  label: string;
  sublabel: string;
  status: "actual" | "proposal";
  fixed: Record<LevyClass, number>;
  rate: Record<LevyClass, number>;
  rebate: { residentialCap: number | null; primaryCap: number | null } | null;
}

export interface LevyLine {
  version: LevyVersion;
  fixed: number;
  variable: number;
  gross: number;
  rebate: number;
  net: number;
  changeVsBase: number | null;
  changePctVsBase: number | null;
}

export const levyData = levy as unknown as {
  note: string;
  classes: Record<LevyClass, { label: string; short: string }>;
  versions: LevyVersion[];
  defaults: { civ: number; class: LevyClass };
  civRange: { min: number; max: number; step: number };
};

export const BASE_VERSION_ID = "fspl-2024-25";

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateLevy(civ: number, cls: LevyClass, volunteer: boolean): LevyLine[] {
  const base = levyData.versions.find((v) => v.id === BASE_VERSION_ID);
  const lines = levyData.versions.map((version) => {
    const fixed = version.fixed[cls];
    const variable = roundCurrency((civ / 1000) * version.rate[cls] / 100);
    const gross = roundCurrency(fixed + variable);
    let rebate = 0;
    if (volunteer && version.rebate) {
      if (cls === "residential") rebate = gross;
      else if (version.rebate.primaryCap != null) rebate = Math.min(gross, version.rebate.primaryCap);
    }
    const net = roundCurrency(gross - rebate);
    return { version, fixed, variable, gross, rebate, net, changeVsBase: null as number | null, changePctVsBase: null as number | null };
  });
  const baseLine = lines.find((l) => l.version.id === BASE_VERSION_ID);
  if (base && baseLine) {
    for (const line of lines) {
      if (line.version.id === BASE_VERSION_ID) continue;
      line.changeVsBase = roundCurrency(line.net - baseLine.net);
      line.changePctVsBase = baseLine.net > 0 ? Math.round(((line.net - baseLine.net) / baseLine.net) * 1000) / 10 : null;
    }
  }
  return lines;
}

export function formatDollars(value: number, opts: { cents?: boolean } = {}) {
  const abs = Math.abs(value);
  const showCents = opts.cents ?? abs % 1 !== 0;
  const text = abs.toLocaleString("en-AU", { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0 });
  return `${value < 0 ? "−" : ""}$${text}`;
}

export function formatSigned(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatDollars(Math.abs(value))}`;
}

export function formatPct(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("en-AU", { maximumFractionDigits: 1 })}%`;
}

export function formatCiv(civ: number) {
  if (civ >= 1_000_000) {
    const m = civ / 1_000_000;
    return `$${m.toLocaleString("en-AU", { maximumFractionDigits: 2 })} million`;
  }
  return `$${(civ / 1000).toLocaleString("en-AU", { maximumFractionDigits: 0 })},000`;
}
