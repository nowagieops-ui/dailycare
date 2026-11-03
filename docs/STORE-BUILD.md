# Store build checklist

Tooling: EAS CLI is installed locally in `tools/` (not in the app, so its audit findings never ship). Run it from `app/`:
`../tools/node_modules/.bin/eas <command>`

## You (accounts, in this order)
1. Expo account (free): https://expo.dev/signup. Use a company email, turn on 2FA.
2. `cd app && ../tools/node_modules/.bin/eas login`, then `... eas init` (creates the EAS project and writes its ID into app.json; push notifications need it).
3. Apple Developer Program ($99/yr, enrol as an organization; needs a D-U-N-S number, which can take days): https://developer.apple.com/programs/enroll/
4. Google Play Console ($25 once, organization account also needs D-U-N-S): https://play.google.com/console/signup
5. A real app icon: 1024x1024 PNG, square, no transparency, no rounded corners. The current icon is the Expo placeholder and stores will not accept it as-is.

## Before submitting
- Bundle ID / package is `com.dailycaresupport.app` (cannot change after first release).
- Privacy policy on the website must mention the app, GPS location (including background) and push notifications.
- Google Play: background location needs a Permissions Declaration plus a short demo video.
- Apple: "Always" location needs a clear purpose string (already set) and review notes explaining the leave-site alert.
- App Store review needs a demo staff login for the reviewer.
- Child accounts are not used; set the age rating accordingly.
