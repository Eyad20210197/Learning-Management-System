import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'firstName must contain a non-whitespace character',
  })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'lastName must contain a non-whitespace character',
  })
  lastName?: string;
}
