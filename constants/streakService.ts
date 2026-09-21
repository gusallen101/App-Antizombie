// services/streakService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = '@user_streak_data';

export interface StreakData {
  currentStreak: number;
  lastCompletedDate: string | null; // ISO String
}

export const saveStreak = async (data: StreakData) => {
  try {
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Error guardando la racha", e);
  }
};

export const getStreak = async (): Promise<StreakData> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STREAK_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : { currentStreak: 0, lastCompletedDate: null };
  } catch (e) {
    return { currentStreak: 0, lastCompletedDate: null };
  }
};