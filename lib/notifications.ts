import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { API_CONFIG } from '@/constants/config';

export type NotificationRouteType = 'shared-task' | 'task-reminder' | 'streak-milestone';

export type NotificationData = {
  type: NotificationRouteType;
  categoryId?: string;
  listId?: string;
  listType?: 'personal' | 'shared';
  taskId?: string;
  taskText?: string;
  taskTitle?: string;
  creatorName?: string;
  recipientUserId?: string;
};

type ScheduleNotificationOptions = {
  title: string;
  body: string;
  data?: NotificationData;
  triggerAt?: Date | null;
};

type SharedTaskNotificationOptions = {
  listName: string;
  taskText: string;
  creatorName?: string;
  categoryId?: string;
  listId?: string;
  recipientUserIds?: string[];
};

type TaskReminderNotificationOptions = {
  taskId: string;
  taskText: string;
  dueAt: Date;
  categoryId?: string;
  listType?: 'personal' | 'shared';
  recipients?: string[];
};

const DEFAULT_CHANNEL_ID = 'default';
const STREAK_MILESTONES_KEY = '@notifications:streakMilestones';
const SCHEDULED_TASK_REMINDERS_KEY = '@notifications:scheduledTaskReminders';

const ensureChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6E1F7C',
      sound: 'default',
    });
  }
};

export const ensureNotificationPermissions = async () => {
  const permission = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return permission.status === 'granted';
};

export const scheduleLocalNotification = async ({
  title,
  body,
  data,
  triggerAt,
}: ScheduleNotificationOptions) => {
  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  await ensureChannel();

  const trigger = triggerAt
    ? ({
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
      } as Notifications.NotificationTriggerInput)
    : null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data,
    },
    trigger,
  });
};

const dispatchRemoteNotification = async ({
  recipientUserIds,
  title,
  body,
  data,
}: {
  recipientUserIds: string[];
  title: string;
  body: string;
  data: NotificationData;
}) => {
  if (!recipientUserIds.length) {
    return false;
  }

  try {
    const [apikey] = await Promise.all([AsyncStorage.getItem('@auth:apikey')]);
    if (!apikey) {
      return false;
    }

    const response = await fetch(`${API_CONFIG.baseUrl}notifications/push`, {
      method: 'POST',
      headers: {
        apikey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: recipientUserIds,
        title,
        body,
        data,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
};

export const scheduleSharedListTaskNotification = async ({
  listName,
  taskText,
  creatorName,
  categoryId,
  listId,
  recipientUserIds = [],
}: SharedTaskNotificationOptions) => {
  const resolvedRecipients = recipientUserIds.filter(Boolean);
  const title = 'Nueva tarea en lista compartida';
  const body = `${creatorName ? `${creatorName} ` : ''}agregó “${taskText}” a ${listName}.`;
  const data: NotificationData = {
    type: 'shared-task',
    categoryId,
    listId,
    listType: 'shared',
    taskText,
    creatorName,
  };

  const deliveredRemotely = await dispatchRemoteNotification({
    recipientUserIds: resolvedRecipients,
    title,
    body,
    data,
  });

  if (deliveredRemotely) {
    return null;
  }

  return scheduleLocalNotification({
    title,
    body,
    data,
  });
};

export const scheduleTaskReminderNotification = async ({
  taskId,
  taskText,
  dueAt,
  categoryId,
  listType,
  recipients = [],
}: TaskReminderNotificationOptions) => {
  const reminderDate = new Date(dueAt);
  reminderDate.setHours(reminderDate.getHours() - 24);

  if (reminderDate <= new Date()) {
    return null;
  }

  const existingRaw = await AsyncStorage.getItem(SCHEDULED_TASK_REMINDERS_KEY);
  const existing: Record<string, string> = existingRaw ? JSON.parse(existingRaw) : {};

  if (existing[taskId]) {
    await Notifications.cancelScheduledNotificationAsync(existing[taskId]);
  }

  const resolvedRecipients = recipients.filter(Boolean);
  const title = 'Tarea próxima a vencer';
  const body = `La tarea “${taskText}” vence pronto.`;
  const data: NotificationData = {
    type: 'task-reminder',
    categoryId,
    listType,
    taskId,
    taskText,
  };

  const deliveredRemotely = await dispatchRemoteNotification({
    recipientUserIds: resolvedRecipients,
    title,
    body,
    data,
  });

  if (deliveredRemotely) {
    existing[taskId] = `remote:${taskId}`;
    await AsyncStorage.setItem(SCHEDULED_TASK_REMINDERS_KEY, JSON.stringify(existing));
    return `remote:${taskId}`;
  }

  const notificationId = await scheduleLocalNotification({
    title,
    body,
    data,
    triggerAt: reminderDate,
  });

  if (notificationId) {
    existing[taskId] = notificationId;
    await AsyncStorage.setItem(SCHEDULED_TASK_REMINDERS_KEY, JSON.stringify(existing));
  }

  return notificationId;
};

export const scheduleStreakMilestoneNotification = async (currentStreak: number) => {
  const thresholds = [3, 7, 15, 30, 60, 90, 120, 365];
  const notifiedRaw = await AsyncStorage.getItem(STREAK_MILESTONES_KEY);
  const notified: number[] = notifiedRaw ? JSON.parse(notifiedRaw) : [];

  const pendingMilestones = thresholds.filter((threshold) => currentStreak >= threshold && !notified.includes(threshold));
  if (!pendingMilestones.length) {
    return;
  }

  for (const threshold of pendingMilestones) {
    const title = 'Nueva racha alcanzada';
    const body = `¡Llegaste a una racha de ${threshold} días! Mantén el ritmo.`;
    await scheduleLocalNotification({
      title,
      body,
      data: {
        type: 'streak-milestone',
        taskTitle: `Racha ${threshold}`,
      },
    });
    notified.push(threshold);
  }

  await AsyncStorage.setItem(STREAK_MILESTONES_KEY, JSON.stringify(notified));
};
