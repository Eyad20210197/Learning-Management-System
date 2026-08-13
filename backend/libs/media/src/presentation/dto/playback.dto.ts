import { IsInt, Max, Min } from 'class-validator';

export class PlaybackHeartbeatDto {
  @IsInt()
  @Min(0)
  @Max(604_800)
  positionSeconds!: number;
}
