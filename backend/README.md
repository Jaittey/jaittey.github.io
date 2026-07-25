# Free serverless backend

This folder is the protected backend configuration for the application.

The app does not require a paid server. Firebase Authentication verifies the Google account, Firestore stores the business data, and `firestore.rules` allows only the approved owner email.

Before deployment, replace `YOUR_GOOGLE_EMAIL@gmail.com` in `firestore.rules`, then run:

```bash
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```
