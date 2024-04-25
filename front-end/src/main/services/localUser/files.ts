import path from 'path';

import { app, shell } from 'electron';
import { HederaFile, Prisma } from '@prisma/client';

import { getPrismaClient } from '@main/db';
import { deleteDirectory, getNumberArrayFromString, saveContentToPath } from '@main/utils';

export const getFiles = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.hederaFile.findMany({
      where: {
        user_id: userId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addFile = async (file: Prisma.HederaFileUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  const files = await getFiles(file.user_id);

  if (files.some(acc => acc.file_id === file.file_id)) {
    throw new Error('File ID already exists!');
  }

  await prisma.hederaFile.create({
    data: file,
  });

  return await getFiles(file.user_id);
};

export const removeFile = async (userId: string, fileId: string) => {
  const prisma = getPrismaClient();

  const files = await getFiles(userId);

  if (!files.some(acc => acc.file_id === fileId)) {
    throw new Error(`File ID not found!`);
  }

  await prisma.hederaFile.deleteMany({
    where: {
      user_id: userId,
      file_id: fileId,
    },
  });

  return await getFiles(userId);
};

export const updateFile = async (
  fileId: string,
  userId: string,
  file: Prisma.HederaFileUncheckedUpdateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.hederaFile.updateMany({
    where: {
      file_id: fileId,
      user_id: userId,
    },
    data: {
      ...file,
      user_id: userId,
    },
  });

  return await getFiles(userId);
};

export const showContentInTemp = async (userId: string, fileId: string) => {
  const prisma = getPrismaClient();

  let file: HederaFile | null = null;

  try {
    file = await prisma.hederaFile.findFirst({
      where: {
        user_id: userId,
        file_id: fileId,
      },
    });
  } catch (error) {
    console.log(error);
  }

  if (file === null) {
    throw new Error('File not found');
  }

  if (file.contentBytes === null) {
    throw new Error('File content is unknown');
  }

  const filePath = path.join(app.getPath('temp'), 'electronHederaFiles', `${fileId}.txt`);
  const content = Buffer.from(getNumberArrayFromString(file.contentBytes));

  try {
    const saved = await saveContentToPath(filePath, content);

    if (saved) {
      shell.showItemInFolder(filePath);
      shell.openPath(filePath);
    }
  } catch (error) {
    console.log(error);
    throw new Error('Failed to open file content');
  }
};

export const deleteTempFolder = async () => {
  try {
    const directoryPath = path.join(app.getPath('temp'), 'electronHederaFiles');
    await deleteDirectory(directoryPath);
  } catch {
    /* Empty */
  }
};
