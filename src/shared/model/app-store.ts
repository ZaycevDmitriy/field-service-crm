import { create } from 'zustand';

// Текущая локация работника (минимальный каркас). Наполнение — Phase 6 (геолокация) / Phase 8.
export interface ICurrentLocation {
  latitude: number;
  longitude: number;
}

// App-wide стор (PDR §13.2): кросс-экранное долгоживущее состояние, не привязанное к заявкам.
export interface IAppStore {
  lastUpdateCheck: string | null;
  currentLocation: ICurrentLocation | null;
  setLastUpdateCheck: (timestamp: string | null) => void;
  setCurrentLocation: (location: ICurrentLocation | null) => void;
}

export const useAppStore = create<IAppStore>()((set) => ({
  lastUpdateCheck: null,
  currentLocation: null,
  setLastUpdateCheck: (timestamp) => set({ lastUpdateCheck: timestamp }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
}));
