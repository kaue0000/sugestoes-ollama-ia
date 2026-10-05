import { IsString, MaxLength, MinLength } from "class-validator";

export class ClassificarChamadoDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  texto: string;
}