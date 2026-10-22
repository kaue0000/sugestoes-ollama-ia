import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnalisarArquivoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  prompt!: string;
}