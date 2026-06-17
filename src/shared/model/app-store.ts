import { create } from 'zustand';

// Текущая локация работника (минимальный каркас). Наполнение — Phase 6 (геолокация) / Phase 8.
export interface ICurrentLocation {
  latitude: number;
  longitude: number;
}

// App-wide стор (PDR §13.2): кросс-экранное долгоживущее состояние, не привязанное к заявкам.
// В Phase 3 фактически задействован только `offline` (OfflineBanner); остальные поля — задел.
export interface IAppStore {
  offline: boolean;
  lastUpdateCheck: string | null;
  currentLocation: ICurrentLocation | null;
  setOffline: (offline: boolean) => void;
  setLastUpdateCheck: (timestamp: string | null) => void;
  setCurrentLocation: (location: ICurrentLocation | null) => void;
}

export const useAppStore = create<IAppStore>()((set) => ({
  offline: false,
  lastUpdateCheck: null,
  currentLocation: null,
  setOffline: (offline) => set({ offline }),
  setLastUpdateCheck: (timestamp) => set({ lastUpdateCheck: timestamp }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
}));
