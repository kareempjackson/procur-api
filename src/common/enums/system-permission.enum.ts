export enum SystemPermission {
  // User Management
  MANAGE_USERS = 'manage_users',
  INVITE_USERS = 'invite_users',
  VIEW_USERS = 'view_users',
  MANAGE_ROLES = 'manage_roles',
  DEACTIVATE_USERS = 'deactivate_users',

  // Procurement
  CREATE_RFP = 'create_rfp',
  APPROVE_PURCHASES = 'approve_purchases',
  VIEW_PROCUREMENT = 'view_procurement',
  MANAGE_VENDORS = 'manage_vendors',
  CREATE_PURCHASE_ORDERS = 'create_purchase_orders',
  APPROVE_CONTRACTS = 'approve_contracts',

  // Reporting & Analytics
  VIEW_REPORTS = 'view_reports',
  EXPORT_DATA = 'export_data',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  CREATE_REPORTS = 'create_reports',
  VIEW_ANALYTICS = 'view_analytics',

  // Government Specific
  CONDUCT_INSPECTIONS = 'conduct_inspections',
  ISSUE_PERMITS = 'issue_permits',
  REGULATORY_OVERSIGHT = 'regulatory_oversight',
  POLICY_MANAGEMENT = 'policy_management',
  COMPLIANCE_MONITORING = 'compliance_monitoring',
  LICENSE_MANAGEMENT = 'license_management',

  // Organization Management
  MANAGE_ORGANIZATION = 'manage_organization',
  VIEW_ORGANIZATION = 'view_organization',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_BILLING = 'manage_billing',

  // Inventory Management
  MANAGE_INVENTORY = 'manage_inventory',
  VIEW_INVENTORY = 'view_inventory',
  TRACK_SHIPMENTS = 'track_shipments',
  QUALITY_CONTROL = 'quality_control',

  // Finance
  MANAGE_PAYMENTS = 'manage_payments',
  VIEW_FINANCIAL_REPORTS = 'view_financial_reports',
  APPROVE_INVOICES = 'approve_invoices',
  MANAGE_BUDGETS = 'manage_budgets',

  // Government-specific permissions
  MANAGE_GOVERNMENT_TABLES = 'manage_government_tables',
  VIEW_GOVERNMENT_DATA = 'view_government_data',
  CREATE_GOVERNMENT_CHARTS = 'create_government_charts',
  MANAGE_GOVERNMENT_REPORTS = 'manage_government_reports',
  EDIT_SELLER_DATA = 'edit_seller_data',
  MANAGE_GOVERNMENT_ANALYTICS = 'manage_government_analytics',
  EXPORT_GOVERNMENT_DATA = 'export_government_data',
  MANAGE_ROLE_PERMISSIONS = 'manage_role_permissions',
}
