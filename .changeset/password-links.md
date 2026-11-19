---
'@kitcms/core': patch
'@kitcms/ui': patch
---

Password links by email. "Forgot your password?" on the sign-in page emails a reset link that works for one hour, and admins can create a user with "Email an invite" so the new user chooses their own password (link valid for 7 days). Links are single-use and stored only as hashes; setting a password signs the user out everywhere and cancels their other links. Requests are rate-limited, and the reply never says whether an account exists. Needs `email` in the config.
