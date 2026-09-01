import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createDataset, fallbackData, type Dataset, type Period, type RawData } from "@/lib/lms";
import { clearUpload, loadUpload, saveUpload, type StoredUpload } from "@/lib/lms-store";

/**
 * Filters live here (not per page) so a selection carries over to the next page
 * whenever that page offers the same filter. Pages simply ignore the keys they
 * do not render, so those selections have no effect there.
 */
export type Filters = {
  period: Period | null;
  subjects: string[];
  classes: string[];
  leads: string[];
  regions: string[];
  schools: string[];
  issues: string[];
};

const EMPTY_FILTERS: Filters = {
  period: null,
  subjects: [],
  classes: [],
  leads: [],
  regions: [],
  schools: [],
  issues: [],
};

type Ctx = {
  data: Dataset;
  recordCount: number;
  source: { label: string; uploadedAt: string | null };
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  applyUpload: (fileName: string, raw: RawData) => Promise<void>;
  resetToBundled: () => Promise<void>;
};

const LmsContext = createContext<Ctx | null>(null);

export function LmsProvider({ children }: { children: ReactNode }) {
  // The bundled dataset (generated from Dashboard_Data_Set.xlsx) always renders
  // instantly; a weekly re-upload stored in IndexedDB overrides it once loaded.
  const [upload, setUpload] = useState<StoredUpload | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    let alive = true;
    loadUpload()
      .then((u) => alive && u && setUpload(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<Ctx>(() => {
    const raw = upload?.data ?? fallbackData;
    return {
      data: createDataset(raw),
      recordCount: raw.teachers.length + raw.video.length + raw.assessment.length,
      source: {
        label: upload ? upload.fileName : "Dashboard Data Set",
        uploadedAt: upload?.uploadedAt ?? null,
      },
      filters,
      setFilter: (key, val) => setFilters((f) => ({ ...f, [key]: val })),
      async applyUpload(fileName, data) {
        const stored: StoredUpload = { fileName, uploadedAt: new Date().toISOString(), data };
        await saveUpload(stored);
        setUpload(stored);
        setFilters(EMPTY_FILTERS);
      },
      async resetToBundled() {
        await clearUpload();
        setUpload(null);
        setFilters(EMPTY_FILTERS);
      },
    };
  }, [upload, filters]);

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
}

export function useLmsContext() {
  const ctx = useContext(LmsContext);
  if (!ctx) throw new Error("useLms must be used inside <LmsProvider>");
  return ctx;
}

export function useLms(): Dataset {
  return useLmsContext().data;
}

/** A shared, cross-page multi-select filter. */
export function useFilter(key: Exclude<keyof Filters, "period">) {
  const { filters, setFilter } = useLmsContext();
  return [filters[key], (v: string[]) => setFilter(key, v)] as const;
}

/** Period state shared across pages; follows the dataset range until changed. */
export function usePeriod() {
  const { data, filters, setFilter } = useLmsContext();
  const dp = data.defaultPeriod;
  const lastRange = useRef(`${dp.from}|${dp.to}`);
  useEffect(() => {
    const range = `${dp.from}|${dp.to}`;
    if (lastRange.current !== range) {
      lastRange.current = range;
      setFilter("period", null);
    }
  }, [dp.from, dp.to]);
  return [filters.period ?? dp, (p: Period) => setFilter("period", p)] as const;
}

/** Select state that falls back to the first available option as data loads. */
export function useSelection(options: string[]) {
  const [value, setValue] = useState("");
  const current = options.includes(value) ? value : (options[0] ?? "");
  return [current, setValue] as const;
}
