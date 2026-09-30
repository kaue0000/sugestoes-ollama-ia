import { IsString, MaxLength, MinLength } from "class-validator";

export class ResponderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  mensagem: string;
}