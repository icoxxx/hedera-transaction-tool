import { Ref, nextTick } from 'vue';
import { Router } from 'vue-router';

import { KeyPair, Organization, Prisma } from '@prisma/client';
import { Mnemonic } from '@hashgraph/sdk';

import {
  ConnectedOrganization,
  LoggedInOrganization,
  LoggedOutOrganization,
  LoggedInUser,
  PersonalUser,
  PublicKeyAccounts,
  RecoveryPhrase,
  LoggedInUserWithPassword,
} from '@renderer/types';

import { getUserState, healthCheck } from '@renderer/services/organization';
import { getKeyPairs, hashRecoveryPhrase } from '@renderer/services/keyPairService';
import { getAccountsByPublicKey } from '@renderer/services/mirrorNodeDataService';
import { storeKeyPair as storeKey } from '@renderer/services/keyPairService';
import { shouldSignInOrganization } from '@renderer/services/organizationCredentials';
import { deleteOrganizationCredentials } from '@renderer/services/organizationCredentials';
import { deleteOrganization, getOrganizations } from '@renderer/services/organizationsService';

/* Flags */
export const isUserLoggedIn = (user: PersonalUser | null): user is LoggedInUser => {
  return user !== null && user.isLoggedIn;
};

export const isLoggedInWithPassword = (
  user: PersonalUser | null,
): user is LoggedInUserWithPassword => {
  return isUserLoggedIn(user) && user.password !== null && user.password.trim() !== '';
};

export const isOrganizationActive = (organization: ConnectedOrganization | null): boolean => {
  return organization !== null && organization.isServerActive;
};

export const isLoggedOutOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedOutOrganization => {
  return organization !== null && organization.isServerActive && organization.loginRequired;
};

export const isLoggedInOrganization = (
  organization: ConnectedOrganization | null,
): organization is Organization & LoggedInOrganization => {
  return organization !== null && organization.isServerActive && !organization.loginRequired;
};

export const accountSetupRequired = (
  organization: ConnectedOrganization | null,
  localKeys: KeyPair[],
) => {
  if (getSecretHashesFromKeys(localKeys).length === 0) return true;
  if (!organization || !isLoggedInOrganization(organization)) return false;

  if (organization.isPasswordTemporary) return true;
  if (organization.secretHashes.length === 0) return true;
  if (
    !organization.userKeys
      .filter(key => key.mnemonicHash)
      .every(key => localKeys.some(k => k.public_key === key.publicKey))
  )
    return true;

  return false;
};

export type AccountSetupPart = 'password' | 'keys';

export const accountSetupRequiredParts = (
  organization: ConnectedOrganization | null,
  localKeys: KeyPair[],
): AccountSetupPart[] => {
  const parts = new Set<AccountSetupPart>();

  if (getSecretHashesFromKeys(localKeys).length === 0) parts.add('keys');
  if (!organization || !isLoggedInOrganization(organization)) return [...parts];

  if (organization.isPasswordTemporary) parts.add('password');
  if (organization.secretHashes.length === 0) parts.add('keys');
  if (
    !organization.userKeys
      .filter(key => key.mnemonicHash)
      .every(key => localKeys.some(k => k.public_key === key.publicKey))
  )
    parts.add('keys');

  return [...parts];
};

/* Entity creation */
export const createPersonalUser = (id?: string, email?: string): PersonalUser =>
  id && email
    ? {
        isLoggedIn: true,
        id,
        email,
        password: null,
      }
    : { isLoggedIn: false };

export const createRecoveryPhrase = async (words: string[]): Promise<RecoveryPhrase> => {
  try {
    const mnemonic = await Mnemonic.fromWords(words);
    const hash = await hashRecoveryPhrase(words);

    return {
      mnemonic,
      words,
      hash,
    };
  } catch {
    throw Error('Invalid recovery phrase');
  }
};

export const storeKeyPair = async (
  keyPair: Prisma.KeyPairUncheckedCreateInput,
  secretHashes: string[],
  password: string,
  encrypted: boolean,
) => {
  if (
    secretHashes.length > 0 &&
    keyPair.secret_hash &&
    !secretHashes.includes(keyPair.secret_hash)
  ) {
    throw Error('Different recovery phrase is used!');
  }

  await storeKey(keyPair, password, encrypted);
};

/* Fetching */
export const getLocalKeyPairs = async (
  user: PersonalUser | null,
  selectedOrganization: ConnectedOrganization | null,
) => {
  if (!user?.isLoggedIn) {
    throw Error('Login to fetch keys');
  }

  let keyPairs = await getKeyPairs(
    user.id,
    selectedOrganization !== null ? selectedOrganization.id : null,
  );

  keyPairs = keyPairs.sort((k1, k2) => {
    if (k1.index < 0) {
      if (k2.index < 0) {
        return k1.nickname && k2.nickname
          ? k1.nickname.localeCompare(k2.nickname)
          : k1.nickname
            ? -1
            : 1;
      }
      return 1;
    } else {
      return k1.index - k2.index;
    }
  });

  return keyPairs;
};

export const updateKeyPairs = async (
  keyPairs: Ref<KeyPair[]>,
  user: PersonalUser | null,
  selectedOrganization: ConnectedOrganization | null,
) => {
  if (user?.isLoggedIn) {
    const newKeys = await getLocalKeyPairs(user, selectedOrganization);
    keyPairs.value = newKeys;
  } else {
    keyPairs.value = [];
  }
};

export const getPublicKeysToAccounts = async (keyPairs: KeyPair[], mirrorNodeBaseURL: string) => {
  const publicKeyToAccounts: PublicKeyAccounts[] = [];

  for (let i = 0; i < keyPairs.length; i++) {
    const keyPair = keyPairs[i];

    const publicKeyPair = publicKeyToAccounts.findIndex(
      pkToAcc => pkToAcc.publicKey === keyPair.public_key,
    );

    const accounts = await getAccountsByPublicKey(mirrorNodeBaseURL, keyPair.public_key);

    if (publicKeyPair >= 0) {
      publicKeyToAccounts[publicKeyPair].accounts = accounts;
    } else {
      publicKeyToAccounts.push({
        publicKey: keyPair.public_key,
        accounts: accounts,
      });
    }
  }

  return publicKeyToAccounts;
};

/* Computations */
export const getSecretHashesFromKeys = (keys: KeyPair[]): string[] => {
  const secretHashes: string[] = [];

  keys.forEach(key => {
    if (key.secret_hash && !secretHashes.includes(key.secret_hash))
      secretHashes.push(key.secret_hash);
  });

  return secretHashes;
};

export const getNickname = (publicKey: string, keyPairs: KeyPair[]): string | undefined => {
  const keyPair = keyPairs.find(kp => kp.public_key === publicKey);
  return keyPair?.nickname || undefined;
};

export const flattenAccountIds = (
  publicKeyToAccounts: PublicKeyAccounts[],
  withDeleted = false,
): string[] => {
  const accountIds: string[] = [];

  publicKeyToAccounts.forEach(pkToAcc => {
    pkToAcc.accounts
      .filter(acc => acc.account !== null && (withDeleted ? true : !acc.deleted))
      .forEach(acc => {
        acc.account && accountIds.push(acc.account);
      });
  });

  return accountIds;
};

/* Organization */
export const getConnectedOrganization = async (
  organization: Organization,
  user: PersonalUser | null,
): Promise<ConnectedOrganization> => {
  if (!isUserLoggedIn(user)) {
    throw Error('Login to select organization');
  }

  const isActive = await healthCheck(organization.serverUrl);

  const inactiveServer: ConnectedOrganization = {
    ...organization,
    isServerActive: false,
    loginRequired: false,
  };

  const activeloginRequired: ConnectedOrganization = {
    ...organization,
    isServerActive: true,
    loginRequired: true,
  };

  if (!isActive) {
    return inactiveServer;
  }

  if (await shouldSignInOrganization(user.id, organization.id)) {
    return activeloginRequired;
  }

  try {
    const { id, email, admin, passwordTemporary, secretHashes, userKeys } = await getUserState(
      organization.serverUrl,
    );

    const connectedOrganization: ConnectedOrganization = {
      ...organization,
      isServerActive: isActive,
      loginRequired: false,
      userId: id,
      email,
      admin,
      isPasswordTemporary: passwordTemporary,
      secretHashes,
      userKeys,
    };

    return connectedOrganization;
  } catch (error) {
    return activeloginRequired;
  }
};

export const afterOrganizationSelection = async (
  user: PersonalUser | null,
  organization: Ref<ConnectedOrganization | null>,
  keyPairs: Ref<KeyPair[]>,
  router: Router,
) => {
  await updateKeyPairs(keyPairs, user, organization.value);
  await nextTick();

  if (!organization.value) {
    navigateToPreviousRoute(router);
    return;
  }

  if (!isOrganizationActive(organization.value)) {
    organization.value = null;

    await updateKeyPairs(keyPairs, user, organization.value);
    await nextTick();

    navigateToPreviousRoute(router);
    return;
  }

  if (isLoggedOutOrganization(organization.value)) {
    router.push({ name: 'organizationLogin' });
    return;
  }

  if (
    isLoggedInOrganization(organization.value) &&
    accountSetupRequired(organization.value, keyPairs.value)
  ) {
    router.push({ name: 'accountSetup' });
    return;
  }

  navigateToPreviousRoute(router);
};

export const refetchUserState = async (organization: Ref<ConnectedOrganization | null>) => {
  if (!organization || !isLoggedInOrganization(organization.value)) return;

  try {
    const { id, email, admin, userKeys, secretHashes, passwordTemporary } = await getUserState(
      organization.value.serverUrl,
    );

    organization.value.userId = id;
    organization.value.email = email;
    organization.value.admin = admin;
    organization.value.userKeys = userKeys;
    organization.value.secretHashes = secretHashes;
    organization.value.isPasswordTemporary = passwordTemporary;
  } catch (error) {
    const activeloginRequired: ConnectedOrganization = {
      id: organization.value.id,
      nickname: organization.value.nickname,
      serverUrl: organization.value.serverUrl,
      key: organization.value.key,
      isServerActive: true,
      loginRequired: true,
    };
    organization.value = activeloginRequired;
  }
};

export const getConnectedOrganizations = async (user: PersonalUser | null) => {
  const organizations = await getOrganizations();

  const connectedOrganizations: ConnectedOrganization[] = [];

  const results = await Promise.allSettled(
    organizations.map(organization => getConnectedOrganization(organization, user)),
  );

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      connectedOrganizations.push(result.value);
    }
  });

  return connectedOrganizations;
};

export const deleteOrganizationConnection = async (
  organizationId: string,
  user: PersonalUser | null,
) => {
  if (!isUserLoggedIn(user)) {
    throw Error('User is not logged in');
  }

  await deleteOrganizationCredentials(organizationId, user.id);
  await deleteOrganization(organizationId);
};

const navigateToPreviousRoute = (router: Router) => {
  const currentRoute = router.currentRoute.value;
  if (router.previousPath) {
    currentRoute.path !== router.previousPath && router.push(router.previousPath);
  } else {
    currentRoute.name !== 'transactions' && router.push({ name: 'transactions' });
  }
};
