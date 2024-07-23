import { Module } from '@nestjs/common';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        ({
          storage:
            new ThrottlerStorageRedisService(configService.getOrThrow('REDIS_URL')),
          throttlers: [
            {
              name: 'anonymous-minute',
              ttl: seconds(60),
              limit: configService.getOrThrow<number>('ANONYMOUS_MINUTE_LIMIT'),
            },
            {
              name: 'anonymous-five-second',
              ttl: seconds(5),
              limit: configService.getOrThrow<number>('ANONYMOUS_FIVE_SECOND_LIMIT'),
            },
          ],
        }),
    }),
  ],
})
export class EmailThrottlerModule {}