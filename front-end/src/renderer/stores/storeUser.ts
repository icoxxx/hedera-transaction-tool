import { computed, ref, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';

import { KeyPair, Organization, Prisma } from '@prisma/client';

import {
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  ConnectedOrganization,
} from '@renderer/types';

import { useRouter } from 'vue-router';

import useNetworkStore from './storeNetwork';
import useContactsStore from './storeContacts';
import useWebsocketConnection from './storeWebsocketConnection';
import useNotificationsStore from './storeNotifications';

import * as ush from '@renderer/utils/userStoreHelpers';

const useUserStore = defineStore('user', () => {
  /* Stores */
  const network = useNetworkStore();
  const contacts = useContactsStore();
  const notifications = useNotificationsStore();
  const ws = useWebsocketConnection();

  /* Composables */
  const router = useRouter();

  /* State */
  /** Keys */
  const publicKeyToAccounts = ref<PublicKeyAccounts[]>([]);
  const recoveryPhrase = ref<RecoveryPhrase | null>(null);
  const keyPairs = ref<KeyPair[]>([]);

  /** Personal */
  const personal = ref<PersonalUser | null>(null);
  const passwordStoreDuration = ref<number>(10 * 60 * 1_000);

  /** Organization */
  const selectedOrganization = ref<ConnectedOrganization | null>(null);
  const organizations = ref<ConnectedOrganization[]>([]);

  /* Computed */
  /** Keys */
  const secretHashes = computed<string[]>(() => ush.getSecretHashesFromKeys(keyPairs.value));
  const publicKeys = computed(() => keyPairs.value.map(kp => kp.public_key));
  const shouldSetupAccount = computed(() =>
    ush.accountSetupRequired(selectedOrganization.value, keyPairs.value),
  );

  /* Actions */
  /** Personal */
  const login = async (id: string, email: string) => {
    personal.value = ush.createPersonalUser(id, email);
    await refetchKeys();
    refetchAccounts();
    await refetchOrganizations();
  };

  const logout = async () => {
    personal.value = ush.createPersonalUser();
    selectedOrganization.value = null;
    organizations.value.splice(0, organizations.value.length);
    publicKeyToAccounts.value.splice(0, publicKeyToAccounts.value.length);
    keyPairs.value = [];
  };

  const getPassword = () => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');
    if (!ush.isLoggedInWithValidPassword(personal.value)) {
      personal.value.password = null;
      return null;
    }

    personal.value.passwordExpiresAt = new Date(Date.now() + passwordStoreDuration.value);
    return personal.value.password;
  };

  const setPassword = (password: string) => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');

    personal.value.password = password;

    if (!ush.isLoggedInWithPassword(personal.value)) throw new Error('Failed to set user password');

    personal.value.passwordExpiresAt = new Date(Date.now() + passwordStoreDuration.value);
  };

  const setPasswordStoreDuration = (durationMs: number) => {
    if (!ush.isUserLoggedIn(personal.value)) throw new Error('User is not logged in');

    const oldDuration = passwordStoreDuration.value;
    passwordStoreDuration.value = durationMs;

    if (ush.isLoggedInWithPassword(personal.value)) {
      const prevSetAt = personal.value.passwordExpiresAt.getTime() - oldDuration;
      personal.value.passwordExpiresAt = new Date(prevSetAt + durationMs);
    }
  };

  /** Keys */
  const setRecoveryPhrase = async (words: string[]) => {
    recoveryPhrase.value = await ush.createRecoveryPhrase(words);
  };

  const refetchAccounts = async () => {
    publicKeyToAccounts.value = await ush.getPublicKeysToAccounts(
      keyPairs.value,
      network.mirrorNodeBaseURL,
    );
  };

  const refetchKeys = async () => {
    await ush.updateKeyPairs(keyPairs, personal.value, selectedOrganization.value);
  };

  const storeKey = async (
    keyPair: Prisma.KeyPairUncheckedCreateInput,
    mnemonic: string[] | string | null,
    password: string,
    encrypted: boolean,
  ) => {
    await ush.storeKeyPair(keyPair, secretHashes.value, mnemonic, password, encrypted);
    await refetchKeys();
    refetchAccounts();
  };

  /* Organization */
  const selectOrganization = async (organization: Organization | null) => {
    ws.setSocket(null);
    await nextTick();

    if (!organization) {
      selectedOrganization.value = null;
      await ush.afterOrganizationSelection(personal.value, selectedOrganization, keyPairs, router);
      await Promise.allSettled([contacts.fetch(), notifications.setup()]);
    } else {
      selectedOrganization.value = await ush.getConnectedOrganization(organization, personal.value);

      const NOTIFICATIONS_SERVICE_PORT = 3020; // See docker-compose.yml in the back-end folder
      if (selectedOrganization.value.isServerActive && !selectedOrganization.value.loginRequired) {
        try {
          ws.setSocket(
            selectedOrganization.value.serverUrl.includes('localhost')
              ? `ws://localhost:${NOTIFICATIONS_SERVICE_PORT}/`
              : `${selectedOrganization.value.serverUrl}/`,
          );
        } catch (error) {
          console.log(error);
        }
      }

      try {
        await ush.afterOrganizationSelection(
          personal.value,
          selectedOrganization,
          keyPairs,
          router,
        );
      } catch (error) {
        await selectOrganization(null);
      }

      const results = await Promise.allSettled([contacts.fetch(), notifications.setup()]);

      results.forEach(result => {
        if (result.status === 'rejected') {
          throw result.reason;
        }
      });
    }

    refetchAccounts();
  };

  const refetchUserState = async () => await ush.refetchUserState(selectedOrganization);

  const refetchOrganizations = async () => {
    organizations.value = await ush.getConnectedOrganizations(personal.value);

    const updatedSelectedOrganization = organizations.value.find(
      o => o.id === selectedOrganization.value?.id,
    );

    if (updatedSelectedOrganization) {
      await selectOrganization(updatedSelectedOrganization);
    }
  };

  const deleteOrganization = async (organizationId: string) => {
    organizations.value = organizations.value.filter(org => org.id !== organizationId);
    await ush.deleteOrganizationConnection(organizationId, personal.value);
  };

  /* Watchers */
  watch(
    () => network.network,
    () => {
      refetchAccounts();
    },
  );
  /* Exports */
  const exports = {
    keyPairs,
    publicKeyToAccounts,
    recoveryPhrase,
    personal,
    selectedOrganization,
    organizations,
    secretHashes,
    publicKeys,
    shouldSetupAccount,
    login,
    logout,
    setRecoveryPhrase,
    refetchKeys,
    refetchAccounts,
    storeKey,
    selectOrganization,
    getPassword,
    setPassword,
    setPasswordStoreDuration,
    refetchUserState,
    deleteOrganization,
    refetchOrganizations,
  };

  return exports;
});

export default useUserStore;
