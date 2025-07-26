# Subscription Limits System Implementation

## Overview

The subscription limits system has been implemented to enforce account and lot size restrictions based on user subscription plans. This system ensures that users can only access features appropriate to their plan level.

## Plan Specifications

### Free Plan (`free`)
- **Max Accounts**: 3 (including pending + active)
- **Lot Size**: Fixed at 0.01 (no customization)
- **Features**: Basic copy trading only
- **UI**: Shows subscription limits warning card

### Premium Plan (`premium`)
- **Max Accounts**: 5 (including pending + active)
- **Lot Size**: Customizable (no limit)
- **Features**: Advanced copy trading, custom lot sizes, reverse trading
- **UI**: Shows subscription limits info card + premium features card

### Unlimited Plan (`unlimited`)
- **Max Accounts**: Unlimited
- **Lot Size**: Unlimited
- **Features**: All advanced features
- **UI**: No subscription limits card shown

### Managed VPS Plan (`managed_vps`)
- **Max Accounts**: Unlimited
- **Lot Size**: Unlimited
- **Features**: All advanced features + VPS management
- **UI**: No subscription limits card shown

### Admin Plan (`admin`)
- **Max Accounts**: Unlimited
- **Lot Size**: Unlimited
- **Features**: All features + admin access
- **UI**: No subscription limits card shown

## Implementation Details

### 1. Subscription Utilities (`src/lib/subscriptionUtils.ts`)

Contains all the core functions for managing subscription limits:

```typescript
// Core functions
export const getSubscriptionLimits(subscriptionType: string): SubscriptionLimits
export const isUnlimitedPlan(userInfo: UserInfo): boolean
export const canCreateMoreAccounts(userInfo: UserInfo, currentAccountCount: number): boolean
export const canCustomizeLotSizes(userInfo: UserInfo): boolean
export const validateLotSize(userInfo: UserInfo, lotSize: number): LotValidation
export const getPlanDisplayName(subscriptionType: string): string
export const getAccountLimitMessage(userInfo: UserInfo, currentAccountCount: number): string
export const getLotSizeMessage(userInfo: UserInfo): string
export const shouldShowSubscriptionLimitsCard(userInfo: UserInfo): boolean
```

### 2. UI Components Integration

#### Trading Accounts Config (`src/components/TradingAccountsConfig.tsx`)
- Displays subscription limit cards based on plan
- Validates account creation before allowing new accounts
- Validates lot sizes when configuring slave accounts
- Shows appropriate warnings and limits

#### Form Validation
- **Account Creation**: Checks if user can add more accounts before submission
- **Lot Size Validation**: Enforces maximum lot size for restricted plans
- **UI Feedback**: Shows appropriate error messages for limit violations

### 3. Plan-Specific UI Cards

#### Free Plan
```jsx
{userInfo && shouldShowSubscriptionLimitsCard(userInfo) && (
  <Card className="border-yellow-400 bg-yellow-50">
    <AlertTriangle />
    <div>
      <CardTitle>Subscription Limits</CardTitle>
      <p>{getAccountLimitMessage(userInfo, accounts.length)} {getLotSizeMessage(userInfo)}</p>
    </div>
  </Card>
)}
```

#### Premium Plan
```jsx
{userInfo && userInfo.subscriptionType === 'premium' && (
  <Card className="border-purple-400 bg-purple-50">
    <Zap />
    <div>
      <CardTitle>Premium Plan Active</CardTitle>
      <p>Enhanced features: Up to 5 accounts, custom lot sizes, and reverse trading options.</p>
    </div>
  </Card>
)}
```

#### Unlimited Plans
```jsx
{userInfo && isUnlimitedPlan(userInfo) && (
  <Card className="border-green-400 bg-green-50">
    <CheckCircle />
    <div>
      <CardTitle>Unlimited Plan Active</CardTitle>
      <p>Your {planDisplayName} plan includes unlimited accounts and all advanced features.</p>
    </div>
  </Card>
)}
```

## Validation Logic

### Account Creation
1. Check if user is creating new account (not editing)
2. Get current account count (including pending)
3. Check if `canCreateMoreAccounts(userInfo, currentCount)` returns true
4. If false, show error message with plan-specific limits

### Lot Size Validation
1. For slave accounts with custom lot sizes
2. Check if `canCustomizeLotSizes(userInfo)` returns true
3. If false, limit to 0.01 for free plan, allow customization for premium+
4. Validate lot size doesn't exceed plan limits

### UI Element Visibility
- **Lot Size Fields**: Disabled for free plan users
- **Limit Cards**: Only shown for plans with restrictions
- **Advanced Features**: Hidden for lower-tier plans

## Backend Integration

The frontend validation is integrated with the existing backend middleware:

```javascript
// server/src/middleware/subscriptionAuth.js
export const getSubscriptionLimits = (subscriptionType) => {
  return PLAN_LIMITS[subscriptionType] || PLAN_LIMITS['free'];
};
```

## Testing

### Test Script (`test-subscription-limits.cjs`)
Comprehensive test suite that verifies:
- Correct limit assignment for each plan
- Account creation validation
- Lot size validation
- UI card visibility logic

### Running Tests
```bash
node test-subscription-limits.cjs
```

### Test Coverage
- ✅ Free Plan: 3 accounts max, 0.01 lot limit
- ✅ Premium Plan: 5 accounts max, unlimited lot sizes
- ✅ Unlimited Plan: No limits
- ✅ Managed VPS Plan: No limits
- ✅ Admin Plan: No limits

## Security Considerations

1. **Frontend + Backend Validation**: Both frontend and backend enforce limits
2. **API Key Validation**: All requests require valid API keys
3. **Role-Based Access**: Different plans have different feature access
4. **Rate Limiting**: Prevents abuse of account creation endpoints

## Migration Notes

- Existing accounts are not affected by the new limits
- New accounts created after implementation follow the new rules
- Admin users maintain unlimited access regardless of plan changes

## Future Enhancements

1. **Dynamic Limits**: Allow admin to modify limits without code changes
2. **Usage Analytics**: Track account creation and lot size usage
3. **Upgrade Prompts**: Show upgrade options when limits are reached
4. **Granular Permissions**: More fine-grained feature control

## Troubleshooting

### Common Issues

1. **Limit Not Enforced**: Check that `userInfo.subscriptionType` is correctly set
2. **Wrong Limits Applied**: Verify plan mapping in `PLAN_LIMITS` configuration
3. **UI Not Updating**: Ensure components are re-rendering when `userInfo` changes

### Debug Information

Enable debug logging by checking console outputs:
```javascript
console.log('🔍 TradingAccountsConfig - Render', {
  subscriptionType: userInfo.subscriptionType,
  isUnlimitedPlan: isUnlimitedPlan(userInfo),
  shouldShowSubscriptionLimitsCard: shouldShowSubscriptionLimitsCard(userInfo),
});
```

## Summary

The subscription limits system successfully implements the required restrictions:

- **Free users**: Limited to 3 accounts with 0.01 lot size
- **Premium users**: Limited to 5 accounts with custom lot sizes
- **Unlimited/VPS/Admin users**: No restrictions

All validations work both on frontend (for UX) and backend (for security), ensuring a robust and user-friendly experience.
