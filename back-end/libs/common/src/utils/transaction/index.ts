import { Key, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { EntityManager, In, Not } from 'typeorm';

import {
  isExpired,
  getSignatureEntities,
  isPublicKeyInKeyList,
  parseAccountProperty,
  MirrorNodeService,
  attachKeys,
} from '@app/common';
import { User, Transaction, UserKey, TransactionSigner } from '@entities';

export const keysRequiredToSign = async (
  transaction: Transaction,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
  userKeys?: UserKey[],
): Promise<UserKey[]> => {
  const userKeyIdsRequired: Set<number> = new Set<number>();

  if (!transaction) return [];

  /* Deserialize the transaction */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  /* Ignore if expired */
  if (isExpired(sdkTransaction)) return [];

  /* Get the user signatures for this transaction */
  const signatures = await entityManager.find(TransactionSigner, {
    where: {
      transaction: {
        id: transaction.id,
      },
    },
    relations: {
      userKey: true,
    },
    withDeleted: true,
  });

  /* Signer keys */
  const signerKeys = signatures.map(s => s.userKey);

  /* Get all keys */
  if (!userKeys) {
    userKeys = await entityManager.find(UserKey, {
      where: {
        id: Not(In(signerKeys.map(k => k.id))),
      },
    });
  }

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts } = getSignatureEntities(sdkTransaction);

  /* Check if the user has a key that is required to sign */
  for (const userKey of userKeys) {
    const includedInTransaction =
      newKeys.some(key => isPublicKeyInKeyList(userKey.publicKey, key)) &&
      !signatures.some(s => s.userKey.publicKey === userKey.publicKey);

    if (includedInTransaction) {
      userKeyIdsRequired.add(userKey.id);
    }
  }

  const userKeysInKeyOrIsKey = (key: Key) => {
    const keys: UserKey[] = [];
    for (const userKey of userKeys) {
      if (
        isPublicKeyInKeyList(userKey.publicKey, key) &&
        !signatures.some(s => s.userKey.publicKey === userKey.publicKey)
      ) {
        keys.push(userKey);
      }
    }
    return keys;
  };

  /* Check if a key of the user is inside the key of some account required to sign */
  for (const accountId of accounts) {
    try {
      const accountInfo = await mirrorNodeService.getAccountInfo(
        accountId,
        transaction.mirrorNetwork,
      );
      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      userKeysInKeyOrIsKey(key).forEach(userKey => userKeyIdsRequired.add(userKey.id));
    } catch (error) {
      console.log(error);
    }
  }

  /* Check if user has a key included in a receiver account that required signature */
  for (const accountId of receiverAccounts) {
    try {
      const accountInfo = await mirrorNodeService.getAccountInfo(
        accountId,
        transaction.mirrorNetwork,
      );
      const receiverSigRequired = parseAccountProperty(accountInfo, 'receiver_sig_required');
      if (!receiverSigRequired) continue;

      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      userKeysInKeyOrIsKey(key).forEach(userKey => userKeyIdsRequired.add(userKey.id));
    } catch (error) {
      console.log(error);
    }
  }

  return userKeys.filter(userKey => userKeyIdsRequired.has(userKey.id));
};

export const userKeysRequiredToSign = async (
  transaction: Transaction,
  user: User,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
): Promise<number[]> => {
  await attachKeys(user, entityManager);
  if (user.keys.length === 0) return [];

  const userKeysRequiredToSign = await keysRequiredToSign(
    transaction,
    mirrorNodeService,
    entityManager,
    user.keys,
  );

  return userKeysRequiredToSign.map(k => k.id);
};
