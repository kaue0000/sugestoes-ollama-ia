import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SugerirRespostaDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  texto?: string;
}