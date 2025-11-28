import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateLogoUploadUrlDto {
  @ApiProperty({
    description: 'Organization ID this logo belongs to',
  })
  @IsString()
  @MinLength(1)
  organizationId!: string;

  @ApiProperty({
    description: 'Original filename of the logo image',
    example: 'logo.png',
  })
  @IsString()
  @MinLength(1)
  filename!: string;
}

export class LogoUploadUrlResponseDto {
  @ApiProperty({ description: 'Storage bucket name', example: 'public' })
  bucket!: string;

  @ApiProperty({
    description: 'Object path within the bucket',
    example: 'logos/organizations/<orgId>/<uuid>.png',
  })
  path!: string;

  @ApiProperty({
    description: 'Signed URL to upload the logo image via HTTP PUT',
  })
  signedUrl!: string;

  @ApiProperty({
    description: 'Upload token (if required by Supabase signed upload)',
  })
  token!: string;
}
