# Plan Mapping Fix

## Issue Description

The application was not correctly handling the plan name received from the API. The API returns `planName: "managed_vps"` but the application was expecting `IPTRADE Managed VPS`. This caused users with admin subscriptions to be treated as having account limits, when they should have unlimited accounts.

Example API response:
```json
{
    "userId": "b7b33906-8a9f-437c-a001-8cd8adbd09d6",
    "email": "joaquinmetayer@gmail.com",
    "name": "Joaquin Metayer",
    "subscriptionStatus": "active",
    "planName": "managed_vps",
    "isActive": true,
    "statusChanged": false,
    "subscriptionType": "admin"
}
```

## Solution

1. Added a mapping function that translates API plan names to the application's internal plan names
2. Special handling for admin users, always giving them `IPTRADE Managed VPS` plan with unlimited accounts
3. Added additional logging to track plan name mapping
4. Implemented the same mapping in both backend and frontend

## Changes Made

### 1. Backend Changes (server/src/middleware/subscriptionAuth.js)
- Added `mapPlanName` function to map API plan names to application plan names
- Applied this mapping in the `validateSubscription` function
- Enhanced logging to show plan name mapping process

### 2. Frontend Changes (src/context/AuthContext.tsx)
- Added the same `mapPlanName` function in the frontend code
- Applied mapping in the `validateLicense` function
- Enhanced logging to track plan name mapping

### 3. Test Script (test-plan-mapping.js)
- Created a test script to verify the plan name mapping works correctly
- Demonstrates how plan limits are assigned based on plan names
- Shows that admin users correctly get unlimited accounts

## How to Verify the Fix

### 1. Run the Test Script

```bash
node test-plan-mapping.js
```

The output should show:
- For admin users, regardless of plan name, they get mapped to `IPTRADE Managed VPS`
- The `managed_vps` plan gets properly mapped to `IPTRADE Managed VPS`
- Both admin users and managed_vps plans have `maxAccounts: null` (unlimited accounts)

### 2. Test with the Application

1. Run your application
2. Login with an admin account
3. Check the console logs to verify the plan name mapping
4. Verify you can create unlimited accounts

### Important Logs to Look For

In the server logs:
```
🔑 User is admin, mapping to IPTRADE Managed VPS
🔄 Mapped plan name: "managed_vps" => "IPTRADE Managed VPS"
```

In the client logs:
```
🔑 User is admin, mapping to IPTRADE Managed VPS 
🔄 Mapped plan name: "managed_vps" => "IPTRADE Managed VPS"
```

## Plan Mapping Table

| API Plan Name | Application Plan Name | Account Limit | Lot Size Limit |
|---------------|----------------------|--------------|----------------|
| managed_vps   | IPTRADE Managed VPS  | Unlimited    | Unlimited      |
| unlimited     | IPTRADE Unlimited    | Unlimited    | Unlimited      |
| premium       | IPTRADE Premium      | 5 accounts   | Unlimited      |
| free          | null (Free Plan)     | 3 accounts   | 0.01           |

## Admin Users

Users with `subscriptionType: "admin"` will always get:
- Plan name: `IPTRADE Managed VPS`
- Unlimited accounts
- Unlimited lot sizes
- All premium features 