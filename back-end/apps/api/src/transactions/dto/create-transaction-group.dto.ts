import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateTransactionGroupItemDto } from './create-transaction-group-item.dto';
import { Type } from 'class-transformer';

export class CreateTransactionGroupDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  atomic: boolean;

  @IsOptional()
  @IsBoolean()
  sequential: boolean;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionGroupItemDto)
  groupItems: CreateTransactionGroupItemDto[];
}
