import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import { Network } from '@main/shared/enums';

import {
  addAccount,
  changeAccountNickname,
  getAccounts,
  removeAccount,
} from '@main/services/localUser';

const createChannelName = (...props) => ['accounts', ...props].join(':');

export default () => {
  /* Accounts */

  // Get all
  ipcMain.handle(createChannelName('getAll'), (_e, findArgs: Prisma.HederaAccountFindManyArgs) =>
    getAccounts(findArgs),
  );

  // Add
  ipcMain.handle(
    createChannelName('add'),
    (_e, userId: string, accountId: string, network: Network, nickname: string = '') =>
      addAccount(userId, accountId, network, nickname),
  );

  // Remove
  ipcMain.handle(
    createChannelName('remove'),
    (_e, userId: string, accountId: string, nickname: string = '') =>
      removeAccount(userId, accountId, nickname),
  );

  // Change Nickname
  ipcMain.handle(
    createChannelName('changeNickname'),
    (_e, userId: string, accountId: string, nickname: string = '') =>
      changeAccountNickname(userId, accountId, nickname),
  );
};
