import { BuyerBusinessType } from './buyer-business-type.enum';
import { SellerBusinessType } from './seller-business-type.enum';

// Re-export the enums
export { BuyerBusinessType } from './buyer-business-type.enum';
export { SellerBusinessType } from './seller-business-type.enum';

// Union type for all business types
export type BusinessType = BuyerBusinessType | SellerBusinessType;

// Helper function to get valid business types for an account type
export function getValidBusinessTypes(accountType: string): string[] {
  switch (accountType) {
    case 'buyer':
      return Object.values(BuyerBusinessType);
    case 'seller':
      return Object.values(SellerBusinessType);
    default:
      return ['general'];
  }
}

// Helper function to validate business type for account type
export function isValidBusinessType(
  accountType: string,
  businessType: string,
): boolean {
  const validTypes = getValidBusinessTypes(accountType);
  return validTypes.includes(businessType);
}
