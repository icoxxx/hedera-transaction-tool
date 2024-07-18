import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { User, UserKey } from '@entities';
import { UploadUserKeyDto } from './dtos';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';

@Injectable()
export class UserKeysService {
  constructor(@InjectRepository(UserKey) private repo: Repository<UserKey>) {}

  // Get the user key for the provided userKeyId.
  getUserKey(
    where: FindOptionsWhere<UserKey>,
    relations?: FindOptionsRelations<UserKey>,
  ): Promise<UserKey> {
    if (!where) {
      return null;
    }
    return this.repo.findOne({ where, relations });
  }

  // Upload the provided user key for the provided user.
  async uploadKey(user: User, dto: UploadUserKeyDto): Promise<UserKey> {
    // Find the userKey by the publicKey
    let userKey = await this.repo.findOne({
      where: { publicKey: dto.publicKey },
      relations: { user: true },
      withDeleted: true,
    });

    if (userKey) {
      // If the userKey found is owned by a different user,
      // or if the userKey has a non null hash or index that doesn't
      // match the hash or index provided
      // throw an error.
      if (
        userKey.user.id !== user.id ||
        (userKey.mnemonicHash && userKey.mnemonicHash !== dto.mnemonicHash) ||
        (userKey.index && userKey.index !== dto.index)
      ) {
        throw new BadRequestException('Public Key in use.');
      }
      // Set the hash and/or index (only if the current value is null)
      Object.assign(userKey, dto);
    } else {
      userKey = await this.repo.create(dto);
      userKey.user = user;
    }

    if (userKey.deletedAt) {
      await this.repo.recover(userKey);
    }
    return this.repo.save(userKey);
  }

  // Get the list of user keys for the provided userId
  async getUserKeys(userId: number): Promise<UserKey[]> {
    if (!userId) {
      return [];
    }
    return this.repo.find({ where: { user: { id: userId } }, relations: { user: true } });
  }

  // Remove the user key for the provided userKeyId.
  // This is a soft remove, meaning that the deleted timestamp will be set.
  async removeKey(id: number): Promise<boolean> {
    const userKey = await this.getUserKey({ id });
    if (!userKey) {
      throw new NotFoundException('Key not found');
    }
    await this.repo.softRemove(userKey);

    return true;
  }

  /* Returns the count of the user keys for the provided user */
  async getUserKeysCount(userId: number): Promise<number> {
    return this.repo.count({ where: { user: { id: userId } } });
  }
}
