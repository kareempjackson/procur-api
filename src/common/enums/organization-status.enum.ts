export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
  // Smart-wipe state: PII removed, products gone, hidden from every public
  // surface. Distinct from SUSPENDED which is reversible via "Activate".
  ARCHIVED = 'archived',
}
