import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAvatarUploadUrlDto {
  @ApiProperty({ description: 'Original filename including extension' })
  @IsString()
  @IsNotEmpty()
  filename: string;
}

export class AvatarUploadUrlResponseDto {
  @ApiProperty()
  bucket: string;

  @ApiProperty({
    description: 'Storage object path to persist on profile after upload',
  })
  path: string;

  @ApiProperty({ description: 'Signed URL to upload directly to Supabase' })
  signedUrl: string;

  @ApiProperty()
  token: string;
}
