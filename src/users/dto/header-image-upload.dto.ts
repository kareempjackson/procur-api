import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateHeaderImageUploadUrlDto {
  @ApiProperty({ description: 'Organization ID', example: 'uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty({ description: 'Original filename', example: 'header.jpg' })
  @IsString()
  filename!: string;
}

export class HeaderImageUploadUrlResponseDto {
  @ApiProperty({ description: 'Storage bucket name', example: 'public' })
  bucket!: string;

  @ApiProperty({
    description: 'Object path within the bucket',
    example: 'headers/organizations/<orgId>/<uuid>.jpg',
  })
  path!: string;

  @ApiProperty({
    description: 'Signed URL to upload the header image via HTTP PUT',
  })
  signedUrl!: string;

  @ApiProperty({
    description: 'Upload token (if required by Supabase signed upload)',
  })
  token!: string;
}


