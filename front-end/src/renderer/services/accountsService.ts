import { Prisma } from '@prisma/client';

import { Network } from '@main/shared/enums';

import { getMessageFromIPCError } from '@renderer/utils';

export const getAll = async (findArgs: Prisma.HederaAccountFindManyArgs) => {
  try {
    return await window.electronAPI.local.accounts.getAll(findArgs);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked acccounts'));
  }
};

export const add = async (
  userId: string,
  accountId: string,
  network: Network,
  nickname: string = '',
) => {
  try {
    return await window.electronAPI.local.accounts.add(userId, accountId, network, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account link failed'));
  }
};

export const remove = async (userId: string, accountIds: string[]) => {
  try {
    return await window.electronAPI.local.accounts.remove(userId, accountIds);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account unlink failed'));
  }
};

export const changeNickname = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.local.accounts.changeNickname(userId, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account nickname change failed'));
  }
};
