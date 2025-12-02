## WhatsApp Order Flow – Behavior & Matrix (Phase 1 Spec)

This document defines the **intended behavior** of WhatsApp around orders. It is the source of truth for subsequent implementation phases.

The goals:

- **Unify** all WhatsApp order messaging behind a clear, consistent model.
- **Clarify** when and how sellers and buyers are notified via WhatsApp.
- **Standardize** template naming, pairing rules, and configuration.

---

## 1. Canonical Order Events

Each event is a business-level change that may trigger WhatsApp notifications.

- **order_created**
  - A buyer places a new order (via web, mobile, or WhatsApp).
- **order_accepted**
  - A seller accepts an order.
- **order_rejected**
  - A seller rejects an order (optionally with a reason).
- **order_processing**
  - A seller moves an order into processing (e.g. preparing goods).
- **order_shipped**
  - A seller ships an order (optionally with tracking info).
- **order_delivered**
  - A seller or system marks an order as delivered.
- **order_cancelled**
  - An order is cancelled (by buyer, seller, or admin).
- **order_paid**
  - Payment for an order is marked as paid (via gateway or admin).
- **order_disputed**
  - A dispute is opened or the order is flagged as disputed.

These event names are **conceptual**; concrete triggers (e.g. specific service methods or DB changes) can be mapped in later phases.

---

## 2. Actors & Recipients

We distinguish between **who performed** an action and **who should be notified**.

- **Buyer**
  - The organization/user placing and paying for the order.
- **Seller**
  - The organization fulfilling the order.
- **Actor**
  - The specific user or system that triggered the event (buyer, seller, admin, payment webhook, etc.).

For WhatsApp notifications, we classify recipients as:

- **Seller-org WA**
  - A seller **organization phone number**, not necessarily tied to a specific user.
- **Seller-user WA**
  - A **specific seller user**’s WhatsApp number, paired via fingerprint.
- **Buyer WA**
  - A **specific buyer user**’s WhatsApp number, paired via fingerprint.
- **Actor confirm**
  - The WhatsApp user who took the action (primarily for WA-driven flows).

---

## 3. Event → Recipient → Channel Matrix (Target Behavior)

Legend:

- **TPL** – WhatsApp **template message**.
- **TXT** – WhatsApp **plain text** message.
- **none** – No WhatsApp message (may still use email/in-app).
- **paired-only** – Requires a verified user–phone pairing.
- **org-phone-ok** – Can be sent to a raw org phone (no user pairing).

### 3.1 `order_created`

- **Seller-org WA**
  - **Channel**: TPL (`new_order_to_seller_v1`).
  - **Purpose**: Notify seller org of a new order with summary + management link.
  - **Rule**: `org-phone-ok` (still respects opt-out).
- **Seller-user WA**
  - **Channel**: _optional_ TPL (same as above or variant).
  - **Rule**: `paired-only` (via user fingerprint).
- **Buyer WA**
  - **Channel**: none (buyer initiated the order and already sees confirmation in-app/WA).
- **Actor confirm (buyer via WhatsApp)**
  - **Channel**: TXT summary (order number, total, payment status).
  - **Rule**: sent only when checkout happens inside WhatsApp.

### 3.2 `order_accepted`

- **Seller-org WA**
  - **Channel**: none (optional future TPL if ops require it).
- **Seller-user WA**
  - **Channel**: TXT confirmation (“Order accepted ✅”) for WA flows.
  - **Rule**: `paired-only` when tied to a specific seller WA user.
- **Buyer WA**
  - **Channel**: TPL (`order_update_*`) indicating status `accepted`.
  - **Rule**: `paired-only`.
- **Actor confirm (seller via WhatsApp)**
  - **Channel**: TXT; TPL is optional.

### 3.3 `order_rejected`

- **Seller-org WA**
  - **Channel**: none (optional future).
- **Seller-user WA**
  - **Channel**: TXT confirmation (“Order rejected ❌”).
  - **Rule**: `paired-only` for WA flows.
- **Buyer WA**
  - **Channel**: TPL (`order_update_*`) with status `rejected`, optionally including a short reason.
  - **Rule**: `paired-only`.
- **Actor confirm (seller via WhatsApp)**
  - **Channel**: TXT; TPL optional.

### 3.4 `order_processing`

- **Seller-org WA**
  - **Channel**: none.
- **Seller-user WA**
  - **Channel**: TXT (optional, mostly for WA-driven changes).
  - **Rule**: `paired-only`.
- **Buyer WA**
  - **Channel**: optional TPL (`order_update_no_tracking_v1`) with status `processing`.
  - **Rule**: `paired-only`.
- **Actor confirm**
  - **Channel**: TXT only for WA actions.

### 3.5 `order_shipped`

- **Seller-org WA**
  - **Channel**: none (optional ops alert in future).
- **Seller-user WA**
  - **Channel**: TXT confirmation for WA flows.
  - **Rule**: `paired-only`.
- **Buyer WA**
  - **Channel**: TPL (`order_update_with_tracking_v1` if tracking exists, otherwise `order_update_no_tracking_v1`) with status `shipped`.
  - **Rule**: `paired-only`.
- **Actor confirm**
  - **Channel**: TXT.

### 3.6 `order_delivered`

- **Seller-org WA**
  - **Channel**: none.
- **Seller-user WA**
  - **Channel**: TXT confirmation (optional).
  - **Rule**: `paired-only`.
- **Buyer WA**
  - **Channel**: TPL (`order_update_no_tracking_v1`) with status `delivered`.
  - **Rule**: `paired-only`.
- **Actor confirm**
  - **Channel**: TXT.

### 3.7 `order_cancelled`

- **Seller-org WA**
  - **Channel**: optional TPL or TXT if cancellations are critical for ops.
- **Seller-user WA**
  - **Channel**: TXT; optional TPL.
  - **Rule**: `paired-only`.
- **Buyer WA**
  - **Channel**: TPL (`order_update_no_tracking_v1`) with status `cancelled`.
  - **Rule**: `paired-only`.
- **Actor confirm (buyer or seller)**
  - **Channel**: TXT for WA-driven cancellations.

### 3.8 `order_paid`

- **Seller-org WA**
  - **Channel**: optional TPL (not required for v1).
- **Seller-user WA**
  - **Channel**: TPL (`order_update_no_tracking_v1`) with status `paid`.
  - **Rule**: `paired-only` (current payments flow already behaves this way).
- **Buyer WA**
  - **Channel**: TPL (`order_update_no_tracking_v1`) with status `paid`.
  - **Rule**: `paired-only` (current admin flow already behaves this way).
- **Actor confirm**
  - **Channel**: none via WhatsApp (payment UX is handled by web/app or gateway).

### 3.9 `order_disputed`

- **Seller-org WA**
  - **Channel**: optional alert (TPL or TXT), depending on risk policy.
- **Seller-user WA**
  - **Channel**: TXT; optional TPL.
  - **Rule**: `paired-only`.
- **Buyer WA**
  - **Channel**: optional TPL (`order_update_no_tracking_v1`) with status `disputed`.
  - **Rule**: `paired-only`.
- **Actor confirm**
  - **Channel**: TXT for WA-driven disputes.

---

## 4. Pairing & Opt-Out Rules

To protect users and avoid misrouting:

- **User–phone pairing**
  - Implemented via Redis key `wa:fp:<userId> = SHA256(E.164 phone)`.
  - Any **user-specific** template send to Buyer WA or Seller-user WA should use:
    - `sendOrderUpdateIfPaired(userId, phoneE164, orderNumber, status, tracking?, locale)`.
  - If no fingerprint or mismatch is found, **do not send** the template.

- **Org-level phones**
  - `Seller-org WA` notifications (e.g., new order) may go to a raw phone number without a specific user pairing.
  - These still **must respect opt-out** (see below).

- **Opt-out**
  - Before sending any template or text, check:
    - `wa:optout:<to>` in Redis.
  - If present, WhatsApp messaging to that number should be **suppressed**, and a warning logged.

---

## 5. Template Naming & Language

Templates should be versioned and overridable via environment variables.

- **New order (to seller)**
  - **Default name**: `new_order_to_seller_v1`.
  - **Env override**: `WA_TEMPLATE_NEW_ORDER`.
  - **Recipients**: Seller-org WA, optionally Seller-user WA.

- **Order update with tracking**
  - **Default name**: `order_update_with_tracking_v1`.
  - **Env override**: `WA_TEMPLATE_UPDATE_WITH_TRACKING`.
  - **Used for**: `order_shipped` (and any event that has a tracking number).

- **Order update without tracking**
  - **Default name**: `order_update_no_tracking_v1`.
  - **Env override**: `WA_TEMPLATE_UPDATE_NO_TRACKING`.
  - **Used for**: `order_accepted`, `order_rejected`, `order_processing`, `order_delivered`, `order_cancelled`, `order_paid`, `order_disputed` (when no tracking).

- **OTP**
  - **Default name**: `otp_verify`.
  - **Env override**: `WA_TEMPLATE_OTP`.
  - **Used for**: account verification and unlock flows (not order-specific, but part of WA infra).

- **Languages**
  - Supported languages: `en_US` (English), `es_ES` (Spanish).
  - Language selection is derived from user/session locale:
    - `locale === 'es'` → `es_ES`
    - otherwise → `en_US`.

---

## 6. Configuration Checklist (Phase 1)

To keep implementations and environments consistent, the following configuration must be defined and documented:

- **WhatsApp configuration**
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_TOKEN`
  - `WHATSAPP_APP_SECRET`
  - `WHATSAPP_VERIFY_TOKEN`
  - `WHATSAPP_ADMIN_TOKEN`

- **Template configuration**
  - `WA_TEMPLATE_NEW_ORDER` (default `new_order_to_seller_v1`)
  - `WA_TEMPLATE_UPDATE_WITH_TRACKING` (default `order_update_with_tracking_v1`)
  - `WA_TEMPLATE_UPDATE_NO_TRACKING` (default `order_update_no_tracking_v1`)
  - `WA_TEMPLATE_OTP` (default `otp_verify`)

- **Behavioral configuration**
  - `WHATSAPP_IDLE_LOCK_DAYS` (locks accounts after inactivity).
  - Any future flags controlling whether certain events (e.g. `order_processing`, `order_disputed`) actually send buyer-facing templates.

All future changes to the WhatsApp order flow should update this document first, then be implemented in code to match.
