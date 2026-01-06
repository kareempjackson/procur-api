import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendTestTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  previewTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateId?: string;
}
