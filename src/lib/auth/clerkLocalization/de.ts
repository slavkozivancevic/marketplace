/**
 * Corrections over Clerk's `deDE`, which is complete and formal ("Sie") apart
 * from these: the sign-in footer linked "Anmelden" to sign-up, the sign-in
 * subtitle was "weiter zu …" instead of a welcome, sign-up offered "Mit E-Mail
 * einloggen", the restricted-access screen read "Mehr erfahren" / "Zugang
 * verweigert?", a handful of strings said "du", and a dozen were missing. The
 * site says "anmelden" and "Konto", so Clerk does too.
 *
 * Flat dotted paths, deep-merged over `deDE` in `./index.ts`, checked against
 * Clerk's English resource in `clerkLocalization.test.ts`.
 */
export const DE_STRINGS: Record<string, string> = {
  // missing in deDE
  formFieldInput__emailAddress_format: "Beispielformat: name@beispiel.de",
  "signIn.enterpriseConnections.subtitle": "Wählen Sie das Unternehmenskonto aus, mit dem Sie fortfahren möchten.",
  "signIn.enterpriseConnections.title": "Unternehmenskonto auswählen",
  "signIn.passwordCompromised.title": "Passwort kompromittiert",
  "signIn.passwordUntrusted.title": "Passwort nicht vertrauenswürdig",
  "signUp.enterpriseConnections.subtitle": "Wählen Sie das Unternehmenskonto aus, mit dem Sie fortfahren möchten.",
  "signUp.enterpriseConnections.title": "Unternehmenskonto auswählen",
  "organizationSwitcher.action__closeOrganizationSwitcher": "Organisationsauswahl schließen",
  "organizationSwitcher.action__openOrganizationSwitcher": "Organisationsauswahl öffnen",
  "taskChooseOrganization.chooseOrganization.subtitle__createOrganizationDisabled": "Treten Sie einer bestehenden Organisation bei",
  "unstable__errors.form_new_password_matches_current": "Das neue Passwort darf nicht mit dem aktuellen Passwort übereinstimmen.",
  "unstable__errors.form_password_untrusted__sign_in":
    "Ihr Passwort wurde möglicherweise kompromittiert oder ist nicht mehr vertrauenswürdig und kann nicht verwendet werden. Bitte fahren Sie mit einer anderen Methode fort.",

  // "du" -> "Sie"
  badge__you: "Sie",
  "signIn.web3Solana.subtitle": "Wählen Sie unten eine Wallet aus, um sich anzumelden",
  "signUp.web3Solana.subtitle": "Wählen Sie unten eine Wallet aus, um sich zu registrieren",
  "userProfile.passwordPage.successMessage__update": "Ihr Passwort wurde aktualisiert.",
  "userProfile.start.web3WalletsSection.web3SelectSolanaWalletScreen.subtitle":
    "Wählen Sie eine Solana-Wallet aus, um sie mit Ihrem Konto zu verbinden.",
  "unstable__errors.web3_signature_request_rejected":
    "Sie haben die Signaturanfrage abgelehnt. Bitte versuchen Sie es erneut, um fortzufahren.",

  // sign in / sign up wording
  "signIn.emailLink.loading.title": "Anmeldung läuft...",
  "signIn.start.actionLink": "Registrieren",
  "signIn.start.actionText": "Noch kein Konto?",
  "signIn.start.actionText__join_waitlist": "Möchten Sie früher Zugang?",
  "signIn.start.alternativePhoneCodeProvider.title": "Mit {{provider}} bei {{applicationName}} anmelden",
  "signIn.start.subtitle": "Willkommen zurück! Bitte melden Sie sich an, um fortzufahren",
  "signIn.start.title": "Bei {{applicationName}} anmelden",
  "signUp.continue.actionLink": "Anmelden",
  "signUp.continue.actionText": "Sie haben bereits ein Konto?",
  "signUp.continue.subtitle": "Bitte ergänzen Sie die fehlenden Angaben, um fortzufahren.",
  "signUp.restrictedAccess.actionLink": "Anmelden",
  "signUp.restrictedAccess.actionText": "Sie haben bereits ein Konto?",
  "signUp.restrictedAccess.subtitle":
    "Registrierungen sind derzeit deaktiviert. Wenn Sie glauben, dass Sie Zugang haben sollten, wenden Sie sich bitte an den Support.",
  "signUp.restrictedAccess.subtitleWaitlist":
    "Registrierungen sind derzeit deaktiviert. Treten Sie der Warteliste bei, um als Erstes vom Start zu erfahren.",
  "signUp.restrictedAccess.title": "Zugang eingeschränkt",
  "signUp.start.actionLink": "Anmelden",
  "signUp.start.actionLink__use_email": "Stattdessen E-Mail verwenden",
  "signUp.start.actionLink__use_phone": "Stattdessen Telefon verwenden",
  "signUp.start.actionText": "Sie haben bereits ein Konto?",
  "signUp.start.subtitle": "Willkommen! Bitte geben Sie Ihre Daten ein, um zu beginnen.",
  "signUp.start.subtitleCombined": "Willkommen! Bitte geben Sie Ihre Daten ein, um zu beginnen.",
  "userProfile.start.connectedAccountsSection.actionLabel__connectionFailed": "Erneut verbinden",

  // said something else than the English, or dropped the value it carries
  "organizationProfile.invitePage.detailsTitle__inviteFailed":
    "Die Einladungen konnten nicht versendet werden. Für folgende E-Mail-Adressen gibt es bereits ausstehende Einladungen: {{email_addresses}}.",
  "reverification.alternativeMethods.blockButton__emailCode": "Code per E-Mail an {{identifier}} senden",
  "reverification.alternativeMethods.blockButton__phoneCode": "SMS-Code an {{identifier}} senden",
  "signIn.backupCodeMfa.subtitle":
    "Ihren Wiederherstellungscode haben Sie beim Einrichten der Bestätigung in zwei Schritten erhalten.",
  "signIn.password.subtitle": "Geben Sie das Passwort Ihres Kontos ein",
  "signUp.emailCode.subtitle": "Geben Sie den Bestätigungscode ein, der an Ihre E-Mail-Adresse gesendet wurde",
  "signUp.phoneCode.subtitle": "Geben Sie den Bestätigungscode ein, der an Ihr Telefon gesendet wurde",
  "unstable__errors.already_a_member_in_organization": "{{email}} ist bereits Mitglied der Organisation.",
  "unstable__errors.form_username_invalid_length":
    "Der Benutzername muss zwischen {{min_length}} und {{max_length}} Zeichen lang sein.",
  "unstable__errors.phone_number_exists": "Diese Telefonnummer ist bereits vergeben. Bitte wählen Sie eine andere.",
};
