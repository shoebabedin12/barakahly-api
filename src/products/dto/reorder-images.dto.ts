import { IsArray, IsInt } from 'class-validator';

export class ReorderImagesDto {
  @IsArray()
  @IsInt({ each: true })
  imageIds: number[];
}
