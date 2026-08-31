import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createDataset, fallbackData, type Dataset, type Period, type RawData } from "@/lib/lms";
import { clearUpload, loadUpload, saveUpload, type StoredUpload } from "@/lib/lms-store";

type Ctx = {
  data: Dataset;
  recordCount: number;
  source: { label: string; uploadedAt: string | null };
  applyUpload: (fileName: string, raw: RawData) => Promise<void>;
  resetToBundled: () => Promise<void>;
};

const LmsContext = createContext<Ctx | null>(null);

export function LmsProvider({ children }: { children: ReactNode }) {
  // The bundled dataset (generated from Dashboard_Data_Set.xlsx) always renders
  // instantly; a weekly re-upload stored in IndexedDB overrides it once loaded.
  const [upload, setUpload] = useState<StoredUpload | null>(null);

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
      async applyUpload(fileName, data) {
        const stored: StoredUpload = { fileName, uploadedAt: new Date().toISOString(), data };
        await saveUpload(stored);
        setUpload(stored);
      },
      async resetToBundled() {
        await clearUpload();
        setUpload(null);
      },
    };
  }, [upload]);

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

/** Period state that follows the dataset's date range until the user changes it. */
export function usePeriod() {
  const { data } = useLmsContext();
  const dp = data.defaultPeriod;
  const [override, setOverride] = useState<Period | null>(null);
  useEffect(() => {
    setOverride(null);
  }, [dp.from, dp.to]);
  return [override ?? dp, setOverride as (p: Period) => void] as const;
}

/** Select state that falls back to the first available option as data loads. */
export function useSelection(options: string[]) {
  const [value, setValue] = useState("");
  const current = options.includes(value) ? value : (options[0] ?? "");
  return [current, setValue] as const;
}
