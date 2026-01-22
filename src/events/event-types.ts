/**
 * Central registry of all domain event types in the Procur platform.
 * 
 * Naming convention: {domain}.{entity}.{action} or {domain}.{action}
 * Examples: order.created, auth.login.succeeded, payment.refund.completed
 */

// ============================================================================
// Authentication & Users
// ============================================================================
export const AuthEventTypes = {
  SIGNUP_STARTED: 'auth.signup.started',
  SIGNUP_COMPLETED: 'auth.signup.completed',
  EMAIL_VERIFICATION_SENT: 'auth.email.verification_sent',
  EMAIL_VERIFIED: 'auth.email.verified',
  OTP_REQUESTED: 'auth.otp.requested',
  OTP_VERIFIED: 'auth.otp.verified',
  LOGIN_SUCCEEDED: 'auth.login.succeeded',
  LOGIN_FAILED: 'auth.login.failed',
  PASSWORD_CHANGED: 'auth.password.changed',
  INVITATION_SENT: 'auth.invitation.sent',
  INVITATION_ACCEPTED: 'auth.invitation.accepted',
  INVITATION_CANCELLED: 'auth.invitation.cancelled',
} as const;

export const UserEventTypes = {
  PROFILE_UPDATED: 'user.profile.updated',
  AVATAR_UPLOADED: 'user.avatar.uploaded',
  REMOVED_FROM_ORG: 'user.removed_from_org',
} as const;

// ============================================================================
// Organizations
// ============================================================================
export const OrganizationEventTypes = {
  CREATED: 'organization.created',
  VERIFIED: 'organization.verified',
  SUSPENDED: 'organization.suspended',
  ACTIVATED: 'organization.activated',
  DELETED: 'organization.deleted',
  PROFILE_UPDATED: 'organization.profile.updated',
  LOGO_UPLOADED: 'organization.logo.uploaded',
  HEADER_UPLOADED: 'organization.header.uploaded',
} as const;

// ============================================================================
// Products
// ============================================================================
export const ProductEventTypes = {
  CREATED: 'product.created',
  UPDATED: 'product.updated',
  PUBLISHED: 'product.published',
  UNPUBLISHED: 'product.unpublished',
  DELETED: 'product.deleted',
  IMAGE_ADDED: 'product.image.added',
  IMAGE_REMOVED: 'product.image.removed',
  FAVORITED: 'product.favorited',
  UNFAVORITED: 'product.unfavorited',
} as const;

// ============================================================================
// Product Requests & Quotes
// ============================================================================
export const RequestEventTypes = {
  CREATED: 'request.created',
  UPDATED: 'request.updated',
  CLOSED: 'request.closed',
  CANCELLED: 'request.cancelled',
  DELETED: 'request.deleted',
} as const;

export const QuoteEventTypes = {
  SUBMITTED: 'quote.submitted',
  ACCEPTED: 'quote.accepted',
  REJECTED: 'quote.rejected',
  EXPIRED: 'quote.expired',
} as const;

// ============================================================================
// Cart
// ============================================================================
export const CartEventTypes = {
  ITEM_ADDED: 'cart.item.added',
  ITEM_UPDATED: 'cart.item.updated',
  ITEM_REMOVED: 'cart.item.removed',
  CLEARED: 'cart.cleared',
} as const;

// ============================================================================
// Orders
// ============================================================================
export const OrderEventTypes = {
  CREATED: 'order.created',
  ACCEPTED: 'order.accepted',
  REJECTED: 'order.rejected',
  PROCESSING: 'order.processing',
  SHIPPED: 'order.shipped',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
  DISPUTED: 'order.disputed',
  DISPUTE_RESOLVED: 'order.dispute.resolved',
  DRIVER_ASSIGNED: 'order.driver.assigned',
  INSPECTION_APPROVED: 'order.inspection.approved',
  OFFLINE_CREATED: 'order.offline.created',
} as const;

// ============================================================================
// Payments
// ============================================================================
export const PaymentEventTypes = {
  INITIATED: 'payment.initiated',
  LINK_CREATED: 'payment.link.created',
  SUCCEEDED: 'payment.succeeded',
  FAILED: 'payment.failed',
  REFUND_INITIATED: 'payment.refund.initiated',
  REFUND_COMPLETED: 'payment.refund.completed',
  SETTLED: 'payment.settled',
} as const;

// ============================================================================
// Payouts
// ============================================================================
export const PayoutEventTypes = {
  REQUESTED: 'payout.requested',
  APPROVED: 'payout.approved',
  REJECTED: 'payout.rejected',
  COMPLETED: 'payout.completed',
  CANCELLED: 'payout.cancelled',
} as const;

// ============================================================================
// Reviews
// ============================================================================
export const ReviewEventTypes = {
  BUYER_CREATED: 'review.buyer.created',
  SELLER_CREATED: 'review.seller.created',
} as const;

// ============================================================================
// Messaging
// ============================================================================
export const ConversationEventTypes = {
  CREATED: 'conversation.created',
  PARTICIPANT_ADDED: 'conversation.participant.added',
  PARTICIPANT_REMOVED: 'conversation.participant.removed',
} as const;

export const MessageEventTypes = {
  SENT: 'message.sent',
  READ: 'message.read',
  DELETED: 'message.deleted',
  CONVERSATION_CREATED: 'message.conversation.created',
} as const;

// ============================================================================
// WhatsApp
// ============================================================================
export const WhatsAppEventTypes = {
  SESSION_STARTED: 'whatsapp.session.started',
  PAIRED: 'whatsapp.paired',
  MESSAGE_RECEIVED: 'whatsapp.message.received',
  MESSAGE_SENT: 'whatsapp.message.sent',
  CHECKOUT_COMPLETED: 'whatsapp.checkout.completed',
  BOT_STARTED: 'whatsapp.bot.started',
} as const;

// ============================================================================
// Harvest Updates
// ============================================================================
export const HarvestEventTypes = {
  UPDATE_CREATED: 'harvest.update.created',
  UPDATE_LIKED: 'harvest.update.liked',
  UPDATE_UNLIKED: 'harvest.update.unliked',
  COMMENT_ADDED: 'harvest.comment.added',
  REQUEST_CREATED: 'harvest.request.created',
} as const;

// ============================================================================
// Farm Visits
// ============================================================================
export const FarmVisitEventTypes = {
  REQUESTED: 'farm_visit.requested',
  APPROVED: 'farm_visit.approved',
  REJECTED: 'farm_visit.rejected',
  COMPLETED: 'farm_visit.completed',
} as const;

// ============================================================================
// Favorites
// ============================================================================
export const FavoriteEventTypes = {
  SELLER_ADDED: 'favorite.seller.added',
  SELLER_REMOVED: 'favorite.seller.removed',
} as const;

// ============================================================================
// Scheduled Posts
// ============================================================================
export const PostEventTypes = {
  SCHEDULED: 'post.scheduled',
  PUBLISHED: 'post.published',
  UPDATED: 'post.updated',
  CANCELLED: 'post.cancelled',
} as const;

// ============================================================================
// Admin Actions
// ============================================================================
export const AdminEventTypes = {
  USER_CREATED: 'admin.user.created',
  USER_UPDATED: 'admin.user.updated',
  USER_DELETED: 'admin.user.deleted',
  DRIVER_CREATED: 'admin.driver.created',
  DRIVER_UPDATED: 'admin.driver.updated',
  DRIVER_DELETED: 'admin.driver.deleted',
  PRODUCT_CREATED: 'admin.product.created',
  PRODUCT_UPDATED: 'admin.product.updated',
  PRODUCT_DELETED: 'admin.product.deleted',
  PLATFORM_FEES_UPDATED: 'admin.platform_fees.updated',
  SELLER_VERIFIED: 'admin.seller.verified',
  SELLER_CREDIT_ADDED: 'admin.seller.credit.added',
  ORDER_STATUS_UPDATED: 'admin.order.status.updated',
  PAYMENT_STATUS_UPDATED: 'admin.order.payment_status.updated',
} as const;

// ============================================================================
// Notifications
// ============================================================================
export const NotificationEventTypes = {
  SENT: 'notification.sent',
  READ: 'notification.read',
  DELIVERY_FAILED: 'notification.delivery.failed',
} as const;

// ============================================================================
// Emails
// ============================================================================
export const EmailEventTypes = {
  SENT: 'email.sent',
  BOUNCED: 'email.bounced',
  OPENED: 'email.opened',
} as const;

// ============================================================================
// Combined Event Types
// ============================================================================
export const EventTypes = {
  Auth: AuthEventTypes,
  User: UserEventTypes,
  Organization: OrganizationEventTypes,
  Product: ProductEventTypes,
  Request: RequestEventTypes,
  Quote: QuoteEventTypes,
  Cart: CartEventTypes,
  Order: OrderEventTypes,
  Payment: PaymentEventTypes,
  Payout: PayoutEventTypes,
  Review: ReviewEventTypes,
  Conversation: ConversationEventTypes,
  Message: MessageEventTypes,
  WhatsApp: WhatsAppEventTypes,
  Harvest: HarvestEventTypes,
  FarmVisit: FarmVisitEventTypes,
  Favorite: FavoriteEventTypes,
  Post: PostEventTypes,
  Admin: AdminEventTypes,
  Notification: NotificationEventTypes,
  Email: EmailEventTypes,
} as const;

// Type helpers
type ValueOf<T> = T[keyof T];
type EventTypeValues<T> = T extends Record<string, infer V> ? V : never;

export type EventType = 
  | ValueOf<typeof AuthEventTypes>
  | ValueOf<typeof UserEventTypes>
  | ValueOf<typeof OrganizationEventTypes>
  | ValueOf<typeof ProductEventTypes>
  | ValueOf<typeof RequestEventTypes>
  | ValueOf<typeof QuoteEventTypes>
  | ValueOf<typeof CartEventTypes>
  | ValueOf<typeof OrderEventTypes>
  | ValueOf<typeof PaymentEventTypes>
  | ValueOf<typeof PayoutEventTypes>
  | ValueOf<typeof ReviewEventTypes>
  | ValueOf<typeof ConversationEventTypes>
  | ValueOf<typeof MessageEventTypes>
  | ValueOf<typeof WhatsAppEventTypes>
  | ValueOf<typeof HarvestEventTypes>
  | ValueOf<typeof FarmVisitEventTypes>
  | ValueOf<typeof FavoriteEventTypes>
  | ValueOf<typeof PostEventTypes>
  | ValueOf<typeof AdminEventTypes>
  | ValueOf<typeof NotificationEventTypes>
  | ValueOf<typeof EmailEventTypes>;

// Aggregate type mapping
export const AggregateTypes = {
  USER: 'user',
  ORGANIZATION: 'organization',
  PRODUCT: 'product',
  REQUEST: 'request',
  QUOTE: 'quote',
  CART: 'cart',
  ORDER: 'order',
  PAYMENT: 'payment',
  PAYOUT: 'payout',
  REVIEW: 'review',
  CONVERSATION: 'conversation',
  MESSAGE: 'message',
  SESSION: 'session',
  HARVEST: 'harvest',
  FARM_VISIT: 'farm_visit',
  FAVORITE: 'favorite',
  POST: 'post',
  ADMIN: 'admin',
  DRIVER: 'driver',
  NOTIFICATION: 'notification',
  EMAIL: 'email',
  SETTINGS: 'settings',
  WHATSAPP: 'whatsapp',
} as const;

export type AggregateType = ValueOf<typeof AggregateTypes>;

// Actor types
export const ActorTypes = {
  USER: 'user',
  SYSTEM: 'system',
  WEBHOOK: 'webhook',
  CRON: 'cron',
  EXTERNAL: 'external',
} as const;

export type ActorType = ValueOf<typeof ActorTypes>;

