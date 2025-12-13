import { UserRole } from '../../common/enums/user-role.enum';
import { AccountType } from '../../common/enums/account-type.enum';
import { OrganizationStatus } from '../../common/enums/organization-status.enum';
import {
  // BuyerBusinessType,
  // SellerBusinessType,
  BusinessType,
} from '../../common/enums/business-types.enum';

export interface DatabaseUser {
  id: string;
  email: string;
  password: string;
  fullname: string;
  phone_number?: string;
  profile_img?: string;
  user_identification_img?: string;
  personal_address?: string;
  country?: string;
  role: UserRole;
  individual_account_type?: AccountType;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOrganization {
  id: string;
  name: string;
  business_name?: string;
  account_type: AccountType;
  business_type?: BusinessType;
  address?: string;
  country?: string;
  phone_number?: string;
  business_registration_number?: string;
  tax_id?: string;
  farmers_id?: string;
  farmers_id_verified?: boolean;
  farm_verified?: boolean;
  payment_details?: any;
  logo_url?: string;
  government_level?: string;
  department?: string;
  jurisdiction?: string;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOrganizationRole {
  id: string;
  organization_id: string;
  name: string;
  display_name: string;
  description?: string;
  is_admin: boolean;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  is_active: boolean;
  invited_by?: string;
  joined_at: string;
  organization_roles: DatabaseOrganizationRole;
  organizations: DatabaseOrganization;
}

export interface DatabaseUserWithOrganization extends DatabaseUser {
  organization_users?: DatabaseOrganizationUser[];
}

export interface DatabasePermission {
  permission_name: string;
  permission_type: 'system' | 'custom';
  category: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  fullname: string;
  individual_account_type?: string;
  phone_number?: string;
  country?: string;
  email_verification_token: string;
  email_verification_expires: Date;
}

export interface UpdateUserData {
  email_verification_token?: string | null;
  email_verification_expires?: string | null;
  email_verified?: boolean;
  last_login?: string;
}

export interface CreateOrganizationData {
  name: string;
  business_name?: string;
  account_type: string;
  business_type?: BusinessType;
  address?: string;
  country?: string;
  phone_number?: string;
  government_level?: string;
  department?: string;
  jurisdiction?: string;
}

// Seller-specific database types
export interface DatabaseProduct {
  id: string;
  seller_org_id: string;
  name: string;
  description?: string;
  short_description?: string;
  sku?: string;
  barcode?: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  base_price: number;
  sale_price?: number;
  currency: string;
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level?: number;
  unit_of_measurement: string;
  weight?: number;
  dimensions?: any;
  condition: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  status: string;
  is_featured: boolean;
  is_organic: boolean;
  is_local: boolean;
  admin_product_id?: string;
  meta_title?: string;
  meta_description?: string;
  slug?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface DatabaseScheduledPost {
  id: string;
  seller_org_id: string;
  product_id?: string;
  title: string;
  content: string;
  post_type: string;
  images?: string[];
  video_url?: string;
  scheduled_for: string;
  published_at?: string;
  target_audience?: any;
  platforms?: string[];
  status: string;
  failure_reason?: string;
  views_count: number;
  likes_count: number;
  shares_count: number;
  comments_count: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOrder {
  id: string;
  order_number: string;
  buyer_org_id: string;
  seller_org_id: string;
  buyer_user_id?: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  shipping_address: any;
  billing_address?: any;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  tracking_number?: string;
  shipping_method?: string;
  buyer_notes?: string;
  seller_notes?: string;
  internal_notes?: string;
  accepted_at?: string;
  rejected_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  // Direct-deposit clearing / inspection workflow
  inspection_status?: string;
  approved_at?: string;
  approved_by_admin_id?: string;
  approval_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFarmerBankInfo {
  id: string;
  farmer_org_id: string;
  token: string;
  encrypted_account_number: string;
  encrypted_account_name: string;
  encrypted_bank_name: string;
  encrypted_bank_branch?: string | null;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  product_snapshot?: any;
  created_at: string;
}

export interface DatabaseTransaction {
  id: string;
  transaction_number: string;
  order_id?: string;
  seller_org_id: string;
  buyer_org_id?: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  payment_method?: string;
  payment_reference?: string;
  gateway_transaction_id?: string;
  platform_fee: number;
  payment_processing_fee: number;
  net_amount?: number;
  description?: string;
  metadata?: any;
  processed_at?: string;
  settled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseOrderTimeline {
  id: string;
  order_id: string;
  event_type: string;
  title: string;
  description?: string;
  actor_user_id?: string;
  actor_type?: string;
  metadata?: any;
  is_visible_to_buyer: boolean;
  is_visible_to_seller: boolean;
  created_at: string;
}

// Create data interfaces
export interface CreateProductData {
  seller_org_id: string;
  name: string;
  description?: string;
  short_description?: string;
  sku?: string;
  barcode?: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  base_price: number;
  sale_price?: number;
  currency?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  unit_of_measurement: string;
  weight?: number;
  dimensions?: any;
  condition?: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  status?: string;
  is_featured?: boolean;
  is_organic?: boolean;
  is_local?: boolean;
  admin_product_id?: string;
  meta_title?: string;
  meta_description?: string;
  slug?: string;
  created_by?: string;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  base_price?: number;
  sale_price?: number;
  currency?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  unit_of_measurement?: string;
  weight?: number;
  dimensions?: any;
  condition?: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  status?: string;
  is_featured?: boolean;
  is_organic?: boolean;
  is_local?: boolean;
  admin_product_id?: string;
  meta_title?: string;
  meta_description?: string;
  slug?: string;
  updated_by?: string;
}

export interface CreateOrderData {
  buyer_org_id: string;
  seller_org_id: string;
  buyer_user_id?: string;
  subtotal: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  total_amount: number;
  currency?: string;
  shipping_address: any;
  billing_address?: any;
  estimated_delivery_date?: string;
  shipping_method?: string;
  buyer_notes?: string;
}

export interface UpdateOrderData {
  status?: string;
  payment_status?: string;
  seller_notes?: string;
  internal_notes?: string;
  tracking_number?: string;
  shipping_method?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
}

export interface CreateScheduledPostData {
  seller_org_id: string;
  product_id?: string;
  title: string;
  content: string;
  post_type?: string;
  images?: string[];
  video_url?: string;
  scheduled_for: string;
  target_audience?: any;
  platforms?: string[];
  created_by?: string;
}
