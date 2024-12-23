import type {
  INotificationReceiver,
  IUpdateNotificationPreferencesDto,
  IUpdateNotificationReceiver,
} from '@main/shared/interfaces';

import { ref } from 'vue';
import { defineStore } from 'pinia';

import { NotificationType } from '@main/shared/interfaces';
import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW } from '@main/shared/constants';

import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getAllInAppNotifications,
  updateNotifications,
} from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import useUserStore from './storeUser';
import useWebsocketConnection from './storeWebsocketConnection';

const useNotificationsStore = defineStore('notifications', () => {
  const user = useUserStore();
  const ws = useWebsocketConnection();

  /* State */
  const notificationsPreferences = ref({
    [NotificationType.TRANSACTION_READY_FOR_EXECUTION]: true,
    [NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES]: true,
  });
  const notifications = ref<{ [serverUrl: string]: INotificationReceiver[] }>({});

  /* Actions */
  async function setup() {
    await fetchPreferences();
    await fetchNotifications();
  }

  /** Preferences **/
  async function fetchPreferences() {
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const userPreferences = await getUserNotificationPreferences(
        user.selectedOrganization?.serverUrl,
      );

      const newPreferences = { ...notificationsPreferences.value };

      for (const preference of userPreferences.filter(p => p.type in newPreferences)) {
        newPreferences[preference.type as keyof typeof newPreferences] = preference.email;
      }

      notificationsPreferences.value = newPreferences;
    }
  }

  async function updatePreferences(data: IUpdateNotificationPreferencesDto) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const newPreferences = await updateUserNotificationPreferences(
      user.selectedOrganization.serverUrl,
      data,
    );

    notificationsPreferences.value = {
      ...notificationsPreferences.value,
      [newPreferences.type]: newPreferences.email,
    };
  }

  /** Notifications **/
  async function fetchNotifications() {
    if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');

    const severUrls = user.organizations.map(o => o.serverUrl);
    const results = await Promise.allSettled(
      user.organizations.map(o => getAllInAppNotifications(o.serverUrl, true)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      result.status === 'fulfilled' && (notifications.value[severUrls[i]] = result.value);
    }

    notifications.value = { ...notifications.value };
  }

  function listenForUpdates() {
    const severUrls = user.organizations.map(o => o.serverUrl);
    for (const severUrl of severUrls) {
      ws.on(severUrl, NOTIFICATIONS_NEW, e => {
        const notification: INotificationReceiver = e.data;

        notifications.value[severUrl] = [...notifications.value[severUrl], notification];
        notifications.value = { ...notifications.value };
      });

      ws.on(severUrl, NOTIFICATIONS_INDICATORS_DELETE, e => {
        const notificationReceiverIds: number[] = e.data.notificationReceiverIds;

        notifications.value[severUrl] = notifications.value[severUrl].filter(
          nr => !notificationReceiverIds.includes(nr.id),
        );
        notifications.value = { ...notifications.value };
      });
    }
  }

  async function markAsRead(type: NotificationType) {
    if (!isLoggedInOrganization(user.selectedOrganization)) {
      throw new Error('No organization selected');
    }

    const notificationsKey = user.selectedOrganization?.serverUrl || '';

    if (!notificationsKey) return;

    const notificationIds = notifications.value[notificationsKey]
      .filter(nr => nr.notification.type === type)
      .map(nr => nr.id);
    const dtos = notificationIds.map((): IUpdateNotificationReceiver => ({ isRead: true }));

    await updateNotifications(notificationsKey, notificationIds, dtos);

    notifications.value[notificationsKey] = notifications.value[notificationsKey].filter(
      nr => !notificationIds.includes(nr.id),
    );
    notifications.value = { ...notifications.value };
  }

  ws.$onAction(ctx => {
    if (ctx.name === 'setup') {
      ctx.after(() => listenForUpdates());
    }
  });

  return {
    notificationsPreferences,
    notifications,
    setup,
    fetchPreferences,
    fetchNotifications,
    updatePreferences,
    markAsRead,
  };
});

export default useNotificationsStore;
