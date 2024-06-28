import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  asyncFilter,
  NOTIFICATIONS_SERVICE,
  NOTIFY_CLIENT,
  NotifyClientDto,
  TRANSACTION_ACTION,
} from '@app/common';
import { TransactionGroup, TransactionGroupItem, User } from '@entities';

import { TransactionsService } from '../transactions.service';

import { CreateTransactionGroupDto } from '../dto';
import { UserDto } from '../../users/dtos';

@Injectable()
export class TransactionGroupsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectRepository(TransactionGroup) private readonly repo: Repository<TransactionGroup>,
    @InjectRepository(TransactionGroupItem)
    private readonly itemRepo: Repository<TransactionGroupItem>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
  ) {}

  getTransactionGroups(): Promise<TransactionGroup[]> {
    return this.repo.find();
  }

  async createTransactionGroup(
    user: UserDto,
    dto: CreateTransactionGroupDto,
  ): Promise<TransactionGroup> {
    const group = this.repo.create(dto);
    const groupItems: TransactionGroupItem[] = [];

    for (const groupItemDto of dto.groupItems) {
      const transaction = await this.transactionsService.createTransaction(
        groupItemDto.transaction,
        user,
      );
      const groupItem = this.itemRepo.create(groupItemDto);
      groupItem.transaction = transaction;
      groupItem.group = group;
      groupItems.push(await this.itemRepo.save(groupItem));
    }

    await this.repo.save(group);
    await this.itemRepo.save(groupItems);

    this.notificationsService.emit<undefined, NotifyClientDto>(NOTIFY_CLIENT, {
      message: TRANSACTION_ACTION,
      content: '',
    });

    return group;
  }

  async getTransactionGroup(user: User, id: number): Promise<TransactionGroup> {
    const group = await this.repo.findOne({
      where: { id },
      relations: [
        'groupItems',
        'groupItems.transaction',
        'groupItems.transaction.creatorKey',
        'groupItems.transaction.creatorKey.user',
        'groupItems.transaction.observers',
      ],
    });

    if (!(group?.groupItems.length > 0)) {
      throw new NotFoundException('Transaction not found');
    }

    group.groupItems = await asyncFilter(group.groupItems, async (groupItem) => {
      return this.transactionsService.verifyAccess(groupItem.transaction, user);
    });

    if (group.groupItems.length === 0) {
      throw new UnauthorizedException("You don't have permission to view this group.");
    }

    return group;
  }

  async removeTransactionGroup(user: UserDto, id: number): Promise<TransactionGroup> {
    const group = await this.repo.findOneBy({ id });
    if (!group) {
      throw new Error('group not found');
    }
    const groupItems = await this.itemRepo.find({
      relations: {
        group: true,
      },
      where: {
        group: {
          id: group.id,
        },
      },
    });
    for (const groupItem of groupItems) {
      const transactionId = groupItem.transactionId;
      await this.itemRepo.remove(groupItem);
      await this.transactionsService.removeTransaction(user, transactionId, false);
    }

    const result = await this.repo.remove(group);

    this.notificationsService.emit<undefined, NotifyClientDto>(NOTIFY_CLIENT, {
      message: TRANSACTION_ACTION,
      content: '',
    });

    return result;
  }
}
