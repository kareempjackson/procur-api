# Procur API Authentication System

This document provides comprehensive setup instructions for the Procur API authentication system with JWT, Supabase, and Postmark integration.

## 🏗️ Architecture Overview

The authentication system includes:

- **JWT-based authentication** with email verification
- **Multi-tenant organization support** with flexible roles
- **Permission-based authorization** with custom permissions
- **Email verification** using Postmark
- **Supabase PostgreSQL** database with advanced schema
- **Swagger API documentation**

## 📋 Prerequisites

1. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
2. **Postmark Account**: Sign up at [postmarkapp.com](https://postmarkapp.com)
3. **Node.js**: Version 18+ recommended

## 🔧 Environment Setup

Create a `.env` file in the project root:

```env
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d

# Email Configuration (Postmark)
POSTMARK_API_KEY=your_postmark_api_key
POSTMARK_FROM_EMAIL=noreply@yourdomain.com

# App Configuration
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001
API_PREFIX=api
API_VERSION=v1
```

## 🗄️ Database Setup

### 1. Apply Migration

Run the Supabase migration to create the database schema:

```bash
# Initialize Supabase (if not done already)
supabase init

# Start local development
supabase start

# Apply the migration
supabase db reset

# Or push to remote Supabase
supabase db push
```

### 2. Verify Schema

The migration creates:

- **Users table** with email verification
- **Organizations table** for multi-tenancy
- **System permissions** with predefined roles
- **Custom permissions** for organization-specific needs
- **Organization roles** with flexible permission assignment
- **Junction tables** for user-organization relationships

## 🚀 API Endpoints

### Authentication Endpoints

All authentication endpoints are public (no JWT required):

#### 1. User Registration

```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "fullname": "John Doe",
  "accountType": "buyer",
  "phoneNumber": "+1234567890",
  "country": "United States"
}
```

**Response:**

```json
{
  "message": "User created successfully. Please check your email for verification.",
  "email": "john.doe@example.com"
}
```

#### 2. Email Verification

```http
POST /api/v1/auth/verify
Content-Type: application/json

{
  "token": "verification_token_from_email"
}
```

**Response:**

```json
{
  "message": "Email verified successfully. Welcome to Procur!",
  "auth": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 604800,
    "user": {
      "id": "user_id",
      "email": "john.doe@example.com",
      "fullname": "John Doe",
      "role": "user",
      "accountType": "buyer",
      "emailVerified": true
    }
  }
}
```

#### 3. User Sign In

```http
POST /api/v1/auth/signin
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

#### 4. Resend Verification Email

```http
POST /api/v1/auth/resend-verification?email=john.doe@example.com
```

### Protected Endpoints

All other endpoints require JWT authentication:

```http
GET /api/v1/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔐 Authorization System

### 1. Guards Available

- **JwtAuthGuard**: Validates JWT tokens
- **EmailVerifiedGuard**: Ensures email is verified
- **RolesGuard**: Checks user roles (user, admin, super_admin)
- **PermissionsGuard**: Validates specific permissions
- **AccountTypeGuard**: Checks account types (buyer, seller, etc.)

### 2. Decorators

```typescript
// Make endpoint public (no authentication required)
@Public()

// Require specific roles
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)

// Require specific permissions
@RequirePermissions('manage_users', 'view_reports')

// Require any of the specified permissions
@RequireAnyPermission('create_rfp', 'approve_purchases')

// Get current user context
@CurrentUser() user: UserContext

// Skip email verification requirement
@RequireEmailVerification(false)
```

### 3. Example Protected Controller

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  @Get('users')
  @RequirePermissions(SystemPermission.VIEW_USERS)
  async getUsers(@CurrentUser() user: UserContext) {
    // Only admins with VIEW_USERS permission can access
    return this.adminService.getUsers();
  }
}
```

## 🏢 Organization Management

### Account Types

- **buyer**: Purchasing organizations
- **seller**: Vendor organizations
- **government**: Government agencies with custom roles
- **driver**: Individual delivery drivers
- **qa**: Quality assurance individuals

### Default Roles Created

When an organization is created, default roles are automatically generated:

**All Organizations:**

- `admin`: Full organization management access
- `staff`: Basic member access

**Government Organizations:**

- `inspector`: Conduct inspections and regulatory oversight
- `procurement_officer`: Manage procurement processes

**Buyer Organizations:**

- `buyer_manager`: Manage purchasing and vendor relationships

**Seller Organizations:**

- `sales_manager`: Manage sales and customer relationships

### Custom Permissions

Organizations can create custom permissions:

```typescript
// Example: Government agency creates custom permission
{
  "name": "approve_organic_certification",
  "display_name": "Approve Organic Certification",
  "description": "Authority to approve organic farming certifications",
  "category": "government"
}
```

## 📧 Email Templates

The system sends three types of emails:

1. **Verification Email**: Sent after signup
2. **Welcome Email**: Sent after email verification
3. **Invitation Email**: Sent when inviting users to organizations

All emails are responsive HTML templates with your branding.

## 📚 API Documentation

Access the interactive Swagger documentation:

```
http://localhost:3000/api/docs
```

The documentation includes:

- All endpoint details
- Request/response schemas
- Authentication examples
- Error responses

## 🧪 Testing the System

### 1. Start the Server

```bash
npm run start:dev
```

### 2. Test Registration Flow

1. **Register a user** via `/api/v1/auth/signup`
2. **Check email** for verification link
3. **Verify email** via `/api/v1/auth/verify`
4. **Sign in** via `/api/v1/auth/signin`
5. **Access protected endpoints** with JWT token

### 3. Test Authorization

```bash
# Get user profile (requires authentication + email verification)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/users/profile

# Access admin endpoint (requires admin role)
curl -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  http://localhost:3000/api/v1/users/admin-only
```

## 🔒 Security Features

- **Password hashing** with bcrypt (12 rounds)
- **JWT token expiration** (configurable)
- **Email verification** required for account activation
- **Role-based access control** (RBAC)
- **Permission-based authorization**
- **Account type restrictions**
- **Token validation** on every request
- **CORS protection** with configurable origins

## 🚨 Error Handling

The API returns consistent error responses:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

Common error codes:

- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/expired token)
- `403`: Forbidden (insufficient permissions)
- `409`: Conflict (duplicate email)

## 🔧 Customization

### Adding New Permissions

1. Add to the `system_permission` enum in the migration
2. Update the `SystemPermission` TypeScript enum
3. Insert into `system_permissions` table
4. Assign to appropriate roles

### Creating Custom Guards

```typescript
@Injectable()
export class CustomGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Your custom authorization logic
    return true;
  }
}
```

## 📈 Performance Considerations

- Database queries are optimized with proper indexes
- JWT tokens are stateless (no database lookups for validation)
- Permission caching can be implemented for high-traffic scenarios
- Connection pooling is handled by Supabase

## 🐛 Troubleshooting

### Common Issues

1. **"JWT_SECRET is required"**
   - Ensure `.env` file has `JWT_SECRET` set

2. **"Supabase configuration is missing"**
   - Verify Supabase URL and keys in `.env`

3. **"Failed to send verification email"**
   - Check Postmark API key and from email configuration

4. **Database connection errors**
   - Ensure Supabase project is running and accessible

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development
```

This provides detailed error messages and request logging.

## 🚀 Production Deployment

1. **Set production environment variables**
2. **Apply database migrations** to production Supabase
3. **Configure email domain** in Postmark
4. **Set up HTTPS** for secure JWT transmission
5. **Configure CORS** for production frontend URLs
6. **Monitor error logs** and performance metrics

## 📞 Support

For issues or questions:

- Check the Swagger documentation at `/api/docs`
- Review error logs for detailed error messages
- Ensure all environment variables are properly configured
