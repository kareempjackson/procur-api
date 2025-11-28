import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { SupabaseService } from '../database/supabase.service';
import { DatabaseFarmerBankInfo } from '../database/types/database.types';
import { UpdateFarmerBankInfoDto } from './dto/update-farmer-bank-info.dto';

type EncryptedPayload = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

@Injectable()
export class BankInfoService {
  private readonly logger = new Logger(BankInfoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly supabase: SupabaseService) {
    const keyHex =
      process.env.BANK_INFO_ENCRYPTION_KEY ||
      process.env.BANK_INFO_ENC_KEY ||
      '';

    if (!keyHex || keyHex.length !== 64) {
      // 32 bytes key in hex
      throw new Error(
        'BANK_INFO_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
      );
    }

    this.key = Buffer.from(keyHex, 'hex');
  }

  // ========== Public API ==========

  async setBankInfo(
    farmerOrgId: string,
    dto: UpdateFarmerBankInfoDto,
    userId: string,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const encAccountNumber = this.encrypt(dto.account_number);
    const encAccountName = this.encrypt(dto.account_name);
    const encBankName = this.encrypt(dto.bank_name);
    const encBranch = dto.bank_branch ? this.encrypt(dto.bank_branch) : null;

    const token = await this.generateToken();

    const payload: Partial<DatabaseFarmerBankInfo> = {
      farmer_org_id: farmerOrgId,
      token,
      encrypted_account_number: JSON.stringify(encAccountNumber),
      encrypted_account_name: JSON.stringify(encAccountName),
      encrypted_bank_name: JSON.stringify(encBankName),
      encrypted_bank_branch: encBranch ? JSON.stringify(encBranch) : null,
      updated_by: userId,
    };

    // Upsert by farmer_org_id (one active record per farmer)
    const { error } = await client.from('farmer_bank_info').upsert(
      {
        ...payload,
        created_by: userId,
      },
      { onConflict: 'farmer_org_id' },
    );

    if (error) {
      this.logger.error('Failed to upsert farmer bank info', error);
      throw new BadRequestException('Unable to save bank information');
    }
  }

  async getMaskedBankInfo(farmerOrgId: string): Promise<{
    account_name: string | null;
    bank_name: string | null;
    account_last4: string | null;
    bank_branch: string | null;
    has_bank_info: boolean;
  }> {
    const raw = await this.getRawRecord(farmerOrgId);
    if (!raw) {
      return {
        account_name: null,
        bank_name: null,
        account_last4: null,
        bank_branch: null,
        has_bank_info: false,
      };
    }

    const accountNumber = this.decryptJson(raw.encrypted_account_number);
    const accountName = this.decryptJson(raw.encrypted_account_name);
    const bankName = this.decryptJson(raw.encrypted_bank_name);
    const bankBranch = raw.encrypted_bank_branch
      ? this.decryptJson(raw.encrypted_bank_branch)
      : null;

    const last4 =
      typeof accountNumber === 'string' && accountNumber.length >= 4
        ? accountNumber.slice(-4)
        : null;

    return {
      account_name: typeof accountName === 'string' ? accountName : null,
      bank_name: typeof bankName === 'string' ? bankName : null,
      account_last4: last4,
      bank_branch: typeof bankBranch === 'string' ? bankBranch : null,
      has_bank_info: true,
    };
  }

  /**
   * Internal only – used by payout flow to build transfer instructions.
   * Never expose full details to frontend.
   */
  async getRawBankInfo(farmerOrgId: string): Promise<{
    account_name: string;
    bank_name: string;
    account_number: string;
    bank_branch?: string | null;
    token: string;
  } | null> {
    const raw = await this.getRawRecord(farmerOrgId);
    if (!raw) return null;

    const accountNumber = this.decryptJson(raw.encrypted_account_number);
    const accountName = this.decryptJson(raw.encrypted_account_name);
    const bankName = this.decryptJson(raw.encrypted_bank_name);
    const bankBranch = raw.encrypted_bank_branch
      ? this.decryptJson(raw.encrypted_bank_branch)
      : null;

    if (
      typeof accountNumber !== 'string' ||
      typeof accountName !== 'string' ||
      typeof bankName !== 'string'
    ) {
      this.logger.warn(
        `Bank info for farmer_org_id=${farmerOrgId} is malformed after decryption`,
      );
      throw new BadRequestException('Bank information is invalid');
    }

    return {
      account_name: accountName,
      bank_name: bankName,
      account_number: accountNumber,
      bank_branch:
        typeof bankBranch === 'string' || bankBranch == null
          ? bankBranch
          : String(bankBranch),
      token: raw.token,
    };
  }

  // ========== Internal helpers ==========

  private async getRawRecord(
    farmerOrgId: string,
  ): Promise<DatabaseFarmerBankInfo | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('farmer_bank_info')
      .select('*')
      .eq('farmer_org_id', farmerOrgId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Failed to load farmer bank info', error);
      throw new BadRequestException('Unable to load bank information');
    }

    return (data as DatabaseFarmerBankInfo) || null;
  }

  private async generateToken(): Promise<string> {
    return randomBytes(12).toString('hex'); // 24-char token
  }

  private encrypt(plain: string): EncryptedPayload {
    const iv = randomBytes(12); // GCM recommended IV size
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  private decryptJson(json: string | null): unknown {
    if (!json) return null;
    let parsed: EncryptedPayload;
    try {
      parsed = JSON.parse(json) as EncryptedPayload;
    } catch (e) {
      this.logger.error('Failed to parse encrypted payload JSON', e as any);
      throw new BadRequestException('Encrypted value is invalid');
    }

    const { iv, authTag, ciphertext } = parsed;
    const ivBuf = Buffer.from(iv, 'base64');
    const tagBuf = Buffer.from(authTag, 'base64');
    const cipherBuf = Buffer.from(ciphertext, 'base64');

    const decipher = createDecipheriv(this.algorithm, this.key, ivBuf);
    decipher.setAuthTag(tagBuf);

    const decrypted = Buffer.concat([
      decipher.update(cipherBuf),
      decipher.final(),
    ]);

    try {
      const text = decrypted.toString('utf8');
      // Might be plain string (account number) or structured JSON; best-effort parse
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (e) {
      this.logger.error('Failed to decrypt payload', e as any);
      throw new BadRequestException('Failed to decrypt value');
    }
  }
}
