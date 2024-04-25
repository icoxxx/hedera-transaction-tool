import { getPrismaClient } from '@main/db';
import { Prisma } from '@prisma/client';

export const getOrganizations = async () => {
  const prisma = getPrismaClient();

  try {
    return await prisma.organization.findMany();
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const getOrganization = async (id: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.organization.findFirst({ where: { id } });
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const addOrganization = async (organization: Prisma.OrganizationCreateInput) => {
  const prisma = getPrismaClient();

  if (
    (await prisma.organization.count({
      where: {
        serverUrl: organization.serverUrl,
      },
    })) > 0
  ) {
    throw new Error('Organization with this server URL already exists');
  }

  if (
    (await prisma.organization.count({
      where: {
        nickname: organization.nickname,
      },
    })) > 0
  ) {
    throw new Error('Organization with this nickname already exists');
  }

  return await prisma.organization.create({ data: organization });
};

export const removeOrganization = async (id: string) => {
  const prisma = getPrismaClient();

  await prisma.keyPair.deleteMany({
    where: {
      organization_id: id,
    },
  });

  await prisma.organizationCredentials.deleteMany({
    where: {
      organization_id: id,
    },
  });

  await prisma.transaction.deleteMany({
    where: {
      organizationId: id,
    },
  });

  await prisma.organization.delete({
    where: {
      id,
    },
  });

  return true;
};

export const updateOrganization = async (
  id: string,
  {
    nickname,
    serverUrl,
    key,
  }: Prisma.OrganizationUncheckedUpdateWithoutOrganizationCredentialsInput,
) => {
  const prisma = getPrismaClient();

  await prisma.organization.updateMany({
    where: {
      id,
    },
    data: {
      nickname,
      serverUrl,
      key,
    },
  });

  return true;
};
