# Clarity subscription setup

Updated September 8, 2026.

## Saved changes

- Enabled all 175 App Store storefronts for `clarity_pro_weekly`, `clarity_pro_monthly`, and `clarity_pro_yearly`, using their existing prices.
- Enabled the yearly product's one-year upfront billing option.
- Added English (U.S.) display names and descriptions for all three products.
- Added a paywall screenshot and review instructions to each product.
- Attached all three App Store products to the existing RevenueCat entitlement `Clarity Pro`.
- Applied RevenueCat's Apple server notification endpoint to both production and sandbox in App Store Connect.

## Verified

- RevenueCat's live SDK API returns `Clarity Pro` for all three App Store products.
- The current offering is `default` and contains the annual, monthly, and weekly App Store product IDs.
- RevenueCat reports valid in-app purchase and App Store Connect API credentials for bundle ID `com.schroedernathan.clarityapp`.
- App Store Connect displays the RevenueCat endpoint for both production and sandbox server notifications.
- The Paid Apps Agreement, banking, and existing tax forms are active.

## Review assets

`yearly-review.png`, `monthly-review.png`, and `weekly-review.png` are actual screenshots of the development app. Their prices come from the RevenueCat Test Store. Each Apple review note explicitly explains this; TestFlight and App Store builds retrieve localized App Store prices.

## Follow-up

- Subscription-level cleanup remains: Apple currently places Yearly at level 1 and Monthly/Weekly at level 2. They provide the same access and should share one level. The browser drag control did not accept the change, so the unsaved editor was canceled. This affects plan-switch behavior, rather than initial purchase availability.
- Complete a TestFlight purchase and confirm Pro unlocks. No Apple sandbox transaction was performed during this setup.
- Apple documents that product metadata changes can take up to one hour to appear in sandbox.

The app and subscription products have not been submitted to App Review as part of this setup.

## References

- [App Store Connect subscription group](https://appstoreconnect.apple.com/apps/6800457983/distribution/subscription-groups/22323737)
- [RevenueCat Clarity Pro entitlement](https://app.revenuecat.com/projects/5b920ed3/product-catalog/entitlements/entlebf76a8ae3)
- [Apple sandbox troubleshooting](https://developer.apple.com/documentation/technotes/tn3186-troubleshooting-in-app-purchases-availability-in-the-sandbox)

## Clarity Pro backend implementation

See [implementation status](../clarity-pro/implementation-status.md) for the deployed Convex access controls, verified RevenueCat development/production webhooks, protected API hosting, test results, and remaining launch checks. Existing product prices were preserved.
