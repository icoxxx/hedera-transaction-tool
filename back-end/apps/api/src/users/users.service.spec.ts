import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { ErrorCodes } from '@app/common';
import { User } from '@entities';

import * as bcrypt from 'bcryptjs';

import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const userRepository = mockDeep<Repository<User>>();

  const email = 'some@email.com';
  const password = 'password';
  const hashedPassword = 'hashedPassword';
  const user: Partial<User> = {
    email,
    password: hashedPassword,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call the repo to find a user', async () => {
    const where: FindOptionsWhere<User> = {
      id: 1,
    };
    const withDeleted: boolean = true;

    await service.getUser(where, withDeleted);

    expect(userRepository.findOne).toHaveBeenCalledWith({ where, withDeleted });
  });

  it('should return null if where is null', async () => {
    const where: FindOptionsWhere<User> = null;
    const withDeleted: boolean = true;

    const result = await service.getUser(where, withDeleted);

    expect(result).toBeNull();
  });

  it('should return null if all values in where are null', async () => {
    const where: FindOptionsWhere<User> = {
      id: null,
    };
    const withDeleted: boolean = true;

    const result = await service.getUser(where, withDeleted);

    expect(result).toBeNull();
  });

  it('should call the repo to find all users', async () => {
    await service.getUsers();

    expect(userRepository.find).toHaveBeenCalled();
  });

  it('should call the repo to create a user', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.create.mockReturnValue(user as User);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => hashedPassword);

    await service.createUser(email, password);

    expect(userRepository.create).toHaveBeenCalledWith(user);
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('should call the repo to restore a user', async () => {
    const userCopy = { ...user, id: 1, deletedAt: new Date() };
    userRepository.findOne.mockResolvedValue(userCopy as User);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => hashedPassword);

    await service.createUser(email, password);

    expect(userRepository.restore).toHaveBeenCalledWith(userCopy.id);
    delete userCopy.deletedAt;

    expect(userRepository.save).toHaveBeenCalledWith({
      ...userCopy,
      status: 'NEW',
    });
  });

  it('should throw if the email already exists', async () => {
    userRepository.findOne.mockResolvedValue(user as User);

    await expect(service.createUser(email, password)).rejects.toThrowError('Email already exists.');
  });

  it('should return user that verifies the email and password', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    jest.spyOn(bcrypt, 'compare').mockImplementationOnce(() => true);

    const result = await service.getVerifiedUser(email, password);

    expect(result).toEqual(user as User);
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.getVerifiedUser(email, password)).rejects.toThrow(
      'Please check your login credentials',
    );
  });

  it('should throw if find user throws error', async () => {
    userRepository.findOne.mockRejectedValue(new Error());

    await expect(service.getVerifiedUser(email, password)).rejects.toThrow(
      'Failed to retrieve user.',
    );
  });

  it('should throw if the password is incorrect', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    jest.spyOn(bcrypt, 'compare').mockImplementationOnce(() => false);

    await expect(service.getVerifiedUser(email, password)).rejects.toThrow(
      'Please check your login credentials',
    );
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.updateUserById(1, {})).rejects.toThrow(ErrorCodes.UNF);
  });

  it('should call the repo to update a user', async () => {
    userRepository.findOne.mockResolvedValue(user as User);

    await service.updateUserById(1, { email });

    expect(userRepository.save).toHaveBeenCalledWith({
      ...user,
      email,
    });
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.updateUserById(1, {})).rejects.toThrow(ErrorCodes.UNF);
  });

  it('should set new password the user', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => hashedPassword);

    await service.setPassword({ ...user } as User, password);

    expect(userRepository.save).toHaveBeenCalledWith({
      ...user,
      password: hashedPassword,
      status: 'NONE',
    });
  });

  it('should remove user', async () => {
    userRepository.findOne.mockResolvedValue(user as User);

    await service.removeUser(1);

    expect(userRepository.softRemove).toHaveBeenCalledWith(user);
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.removeUser(1)).rejects.toThrow(ErrorCodes.UNF);
  });
});
