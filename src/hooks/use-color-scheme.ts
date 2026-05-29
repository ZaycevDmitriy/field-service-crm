import { useColorScheme as useRNColorScheme } from 'react-native';

// В RN 0.85 useColorScheme() возвращает 'light' | 'dark' | 'unspecified'.
// Нормализуем 'unspecified' к 'light' для индексации палитры.
export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
