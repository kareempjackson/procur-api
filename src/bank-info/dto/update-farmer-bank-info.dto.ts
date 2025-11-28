import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateFarmerBankInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  account_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  bank_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  account_number!: string;

  @IsString()
  @MaxLength(150)
  bank_branch?: string;
}
