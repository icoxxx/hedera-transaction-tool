import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

import { Network } from '@entities';

import { TransformBuffer } from '@app/common';

//TODO approvers and observers can be added to this dto, validatenested,
// also adding cascade to the transaction relations to enable single saves
export class CreateTransactionDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNotEmpty()
  @TransformBuffer()
  transactionBytes: Buffer;

  @IsNumber()
  creatorKeyId: number;

  @IsNotEmpty()
  @TransformBuffer()
  signature: Buffer;

  @IsNotEmpty()
  @IsEnum(Network)
  network: Network;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  cutoffAt?: Date;
}
