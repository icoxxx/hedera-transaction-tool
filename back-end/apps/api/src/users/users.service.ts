import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';

import * as bcrypt from 'bcryptjs';

import { User, UserStatus } from '@entities';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  /* Creates a user with a given email and password. */
  async createUser(email: string, password: string): Promise<User> {
    let user = await this.getUser({ email }, true);
    password = await this.getSaltedHash(password);

    if (user) {
      if (!user.deletedAt) throw new UnprocessableEntityException('Email already exists.');

      await this.repo.restore(user.id);

      password = await this.getSaltedHash(password);
      return this.updateUser(user, { email, password, status: UserStatus.NEW });
    }

    user = this.repo.create({
      email,
      password,
    });

    return await this.repo.save(user);
  }

  /* Returns the user for the given email and password. The returned user is valid and verified. */
  async getVerifiedUser(email: string, password: string): Promise<User> {
    let user: User;

    try {
      user = await this.getUser({ email });
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve user.');
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Please check your login credentials');
    }

    return user;
  }

  // Return a user for given values
  getUser(where: FindOptionsWhere<User>, withDeleted = false): Promise<User> {
    // If where is null, or all values in where are null, return null
    if (!where || Object.values(where).every(value => !value)) {
      return null;
    }
    return this.repo.findOne({ where, withDeleted });
  }

  // Return an array of users, containing all current users of the organization.
  getUsers(): Promise<User[]> {
    return this.repo.find();
  }

  async updateUserById(id: number, attrs: Partial<User>): Promise<User> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.updateUser(user, attrs);
  }

  // Update a user with the provided information.
  // If a new password is provided, it will be salted and hashed as per usual, the result will be stored.
  async updateUser(user: User, attrs: Partial<User>): Promise<User> {
    Object.assign(user, attrs);
    return this.repo.save(user);
  }

  // Set the password for the given user. This method is only accessible to a user that is
  // logged in and authenticated, or has verified the email and OTP
  async setPassword(user: User, newPassword: string): Promise<void> {
    // Get the salted password, and set the status to none (no longer new)
    await this.updateUser(user, {
      password: await this.getSaltedHash(newPassword),
      status: UserStatus.NONE,
    });
  }

  // Remove a user from the organization.
  // This is a soft delete, meaning the deletedTimestamp will be set.
  async removeUser(id: number): Promise<boolean> {
    const user = await this.getUser({ id });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.repo.softRemove(user);

    return true;
  }

  // For the given password, create a salt and hash it with the password.
  // Return the result.
  async getSaltedHash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return await bcrypt.hash(password, salt);
  }
}
