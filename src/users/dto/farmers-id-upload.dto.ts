import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateFarmersIdUploadUrlDto {
  @ApiProperty({ description: 'Organization ID to scope the upload' })
  @IsString()
  @Length(1, 128)
  organizationId: string;

  @ApiProperty({ description: 'Original filename (used for extension only)' })
  @IsString()
  @Length(1, 256)
  filename: string;
}

export class FarmersIdUploadUrlResponseDto {
  @ApiProperty({ description: 'Storage bucket name' })
  bucket: string;

  @ApiProperty({ description: 'Storage object path (save this in DB)' })
  path: string;

  @ApiProperty({ description: 'Signed upload URL for PUT' })
  signedUrl: string;

  @ApiProperty({ description: 'Token for the signed upload URL' })
  token: string;
}
