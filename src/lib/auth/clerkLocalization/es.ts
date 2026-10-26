/**
 * Corrections over Clerk's `esES`. The site speaks Spanish with "tú"; Clerk
 * mixes "tú" ("¿No tienes cuenta?") with "usted" ("Regístrese", "Ingrese su
 * contraseña"), leaves ~90 keys untranslated, titles the sign-in "Entrar"
 * without the app name, says "para continuar a …" where the English is a
 * welcome or an instruction, drops values some messages carry, and breaks one
 * placeholder outright (`{{dominio}}` for `{{domain}}`, printed literally).
 *
 * Flat dotted paths, deep-merged over `esES` in `./index.ts`, checked against
 * Clerk's English resource in `clerkLocalization.test.ts`.
 */
export const ES_STRINGS: Record<string, string> = {
  // --- form chrome ---
  footerActionLink__alternativePhoneCodeProvider: "Enviar el código por SMS",
  formFieldError__verificationLinkExpired: "El enlace de verificación ha caducado. Solicita uno nuevo.",
  formFieldInput__emailAddress_format: "Formato de ejemplo: nombre@ejemplo.com",
  formFieldInputPlaceholder__backupCode: "Introduce tu código de respaldo",
  formFieldInputPlaceholder__emailAddress: "Introduce tu correo electrónico",
  formFieldInputPlaceholder__emailAddress_username: "Introduce tu correo electrónico o nombre de usuario",
  formFieldInputPlaceholder__emailAddresses: "ejemplo@email.com, ejemplo2@email.com",
  formFieldInputPlaceholder__firstName: "Nombre",
  formFieldInputPlaceholder__lastName: "Apellido",
  formFieldInputPlaceholder__organizationDomain: "ejemplo.com",
  formFieldInputPlaceholder__organizationDomainEmailAddress: "tu@ejemplo.com",
  formFieldInputPlaceholder__organizationName: "Nombre de la organización",
  formFieldInputPlaceholder__organizationSlug: "mi-organizacion",
  formFieldInputPlaceholder__password: "Introduce tu contraseña",
  formFieldInputPlaceholder__phoneNumber: "Introduce tu número de teléfono",
  formFieldLabel__confirmPassword: "Confirma la contraseña",
  formFieldLabel__organizationDomainEmailAddressDescription:
    "Introduce un correo electrónico de este dominio para recibir un código y verificarlo.",
  badge__you: "Tú",

  // --- sign in ---
  "signIn.accountSwitcher.subtitle": "Selecciona la cuenta con la que quieres continuar.",
  "signIn.accountSwitcher.title": "Elige una cuenta",
  "signIn.alternativeMethods.getHelp.content":
    "Si tienes problemas para iniciar sesión, escríbenos y te ayudaremos a recuperar el acceso lo antes posible.",
  "signIn.alternativePhoneCodeProvider.formTitle": "Código de verificación",
  "signIn.alternativePhoneCodeProvider.resendButton": "¿No recibiste el código? Reenviar",
  "signIn.alternativePhoneCodeProvider.subtitle": "para continuar en {{applicationName}}",
  "signIn.alternativePhoneCodeProvider.title": "Revisa {{provider}}",
  "signIn.backupCodeMfa.subtitle": "Tu código de respaldo es el que recibiste al configurar la verificación en dos pasos.",
  "signIn.emailCode.title": "Revisa tu correo electrónico",
  "signIn.emailCodeMfa.formTitle": "Revisa tu correo electrónico",
  "signIn.emailCodeMfa.title": "Revisa tu correo electrónico",
  "signIn.emailLink.clientMismatch.subtitle":
    "Para continuar, abre el enlace de verificación en el dispositivo y el navegador desde los que iniciaste sesión",
  "signIn.emailLink.clientMismatch.title": "El enlace de verificación no es válido en este dispositivo",
  "signIn.emailLink.expired.title": "Este enlace de verificación ha caducado",
  "signIn.emailLink.formSubtitle": "Usa el enlace de verificación enviado a tu correo electrónico",
  "signIn.emailLink.title": "Revisa tu correo electrónico",
  "signIn.emailLink.unusedTab.title": "Puedes cerrar esta pestaña",
  "signIn.enterpriseConnections.subtitle": "Selecciona la cuenta empresarial con la que quieres continuar.",
  "signIn.enterpriseConnections.title": "Elige tu cuenta empresarial",
  "signIn.newDeviceVerificationNotice":
    "Estás iniciando sesión desde un dispositivo nuevo. Te pedimos una verificación para mantener tu cuenta segura.",
  "signIn.passkey.subtitle":
    "Tu clave de acceso confirma que eres tú. Tu dispositivo puede pedirte la huella, el rostro o el bloqueo de pantalla.",
  "signIn.password.subtitle": "Introduce la contraseña de tu cuenta",
  "signIn.password.title": "Introduce tu contraseña",
  "signIn.passwordCompromised.title": "Contraseña comprometida",
  "signIn.passwordUntrusted.title": "Contraseña no confiable",
  "signIn.resetPassword.requiredMessage": "Por motivos de seguridad, debes restablecer tu contraseña.",
  "signIn.start.actionLink": "Regístrate",
  "signIn.start.alternativePhoneCodeProvider.actionLink": "Usar otro método",
  "signIn.start.alternativePhoneCodeProvider.label": "Número de teléfono de {{provider}}",
  "signIn.start.alternativePhoneCodeProvider.subtitle": "Introduce tu número de teléfono para recibir un código de verificación en {{provider}}.",
  "signIn.start.alternativePhoneCodeProvider.title": "Inicia sesión en {{applicationName}} con {{provider}}",
  "signIn.start.subtitle": "¡Hola de nuevo! Inicia sesión para continuar",
  "signIn.start.title": "Inicia sesión en {{applicationName}}",
  "signIn.start.titleCombined": "Continúa en {{applicationName}}",

  // --- sign up ---
  "signUp.alternativePhoneCodeProvider.resendButton": "¿No recibiste el código? Reenviar",
  "signUp.alternativePhoneCodeProvider.subtitle": "Introduce el código de verificación enviado a {{provider}}",
  "signUp.alternativePhoneCodeProvider.title": "Verifica {{provider}}",
  "signUp.continue.actionText": "¿Ya tienes una cuenta?",
  "signUp.continue.subtitle": "Completa los datos que faltan para continuar.",
  "signUp.emailCode.formSubtitle": "Introduce el código de verificación enviado a tu correo electrónico",
  "signUp.emailCode.subtitle": "Introduce el código de verificación enviado a tu correo electrónico",
  "signUp.emailCode.title": "Verifica tu correo electrónico",
  "signUp.emailLink.clientMismatch.subtitle":
    "Para continuar, abre el enlace de verificación en el dispositivo y el navegador desde los que te registraste",
  "signUp.emailLink.formSubtitle": "Usa el enlace de verificación enviado a tu correo electrónico",
  "signUp.enterpriseConnections.subtitle": "Selecciona la cuenta empresarial con la que quieres continuar.",
  "signUp.enterpriseConnections.title": "Elige tu cuenta empresarial",
  "signUp.legalConsent.checkbox.label__onlyPrivacyPolicy":
    'Acepto la {{ privacyPolicyLink || link("Política de privacidad") }}',
  "signUp.legalConsent.checkbox.label__onlyTermsOfService":
    'Acepto los {{ termsOfServiceLink || link("Términos del servicio") }}',
  "signUp.phoneCode.formSubtitle": "Introduce el código de verificación enviado a tu número de teléfono",
  "signUp.phoneCode.subtitle": "Introduce el código de verificación enviado a tu teléfono",
  "signUp.phoneCode.title": "Verifica tu teléfono",
  "signUp.start.alternativePhoneCodeProvider.actionLink": "Usar otro método",
  "signUp.start.alternativePhoneCodeProvider.label": "Número de teléfono de {{provider}}",
  "signUp.start.alternativePhoneCodeProvider.subtitle": "Introduce tu número de teléfono para recibir un código de verificación en {{provider}}.",
  "signUp.start.alternativePhoneCodeProvider.title": "Regístrate en {{applicationName}} con {{provider}}",
  "signUp.start.subtitle": "¡Bienvenido! Completa tus datos para empezar.",
  "signUp.start.subtitleCombined": "¡Bienvenido! Completa tus datos para empezar.",

  // --- re-verification ---
  "reverification.alternativeMethods.blockButton__emailCode": "Enviar un código a {{identifier}}",
  "reverification.alternativeMethods.blockButton__passkey": "Usa tu clave de acceso",
  "reverification.alternativeMethods.blockButton__phoneCode": "Enviar un código SMS a {{identifier}}",
  "reverification.passkey.blockButton__passkey": "Usa tu clave de acceso",
  "reverification.passkey.subtitle":
    "Tu clave de acceso confirma tu identidad. Tu dispositivo puede pedirte la huella, el rostro o el bloqueo de pantalla.",
  "reverification.passkey.title": "Usa tu clave de acceso",

  // --- account profile ---
  "userProfile.backupCodePage.infoText2":
    "Mantén los códigos de respaldo en secreto y guárdalos en un lugar seguro. Si crees que alguien los conoce, puedes generar otros nuevos.",
  "userProfile.backupCodePage.successMessage":
    "Los códigos de respaldo ya están activados. Si pierdes el acceso a tu dispositivo de autenticación, puedes iniciar sesión con uno de ellos. Cada código solo se puede usar una vez.",
  "userProfile.backupCodePage.successSubtitle":
    "Si pierdes el acceso a tu dispositivo de autenticación, puedes iniciar sesión con uno de estos códigos.",
  "userProfile.connectedAccountPage.formHint": "Selecciona un proveedor para conectar tu cuenta.",
  "userProfile.connectedAccountPage.removeResource.successMessage": "{{connectedAccount}} se ha eliminado de tu cuenta.",
  "userProfile.connectedAccountPage.successMessage": "El proveedor se ha añadido a tu cuenta",
  "userProfile.deletePage.messageLine1":
    "¿Seguro que quieres eliminar tu cuenta? Es posible que se conserven algunos datos asociados. Para solicitar la eliminación completa, contacta con el soporte.",
  "userProfile.emailAddressPage.emailCode.formSubtitle": "Introduce el código de verificación enviado a {{identifier}}",
  "userProfile.emailAddressPage.emailCode.successMessage": "El correo {{identifier}} se ha añadido a tu cuenta.",
  "userProfile.emailAddressPage.emailLink.formSubtitle": "Haz clic en el enlace de verificación del correo enviado a {{identifier}}",
  "userProfile.emailAddressPage.emailLink.successMessage": "El correo {{identifier}} se ha añadido a tu cuenta.",
  "userProfile.emailAddressPage.enterpriseSSOLink.formButton": "Haz clic para iniciar sesión",
  "userProfile.emailAddressPage.enterpriseSSOLink.formSubtitle": "Completa el inicio de sesión con {{identifier}}",
  "userProfile.emailAddressPage.formHint": "Tendrás que verificar este correo electrónico antes de añadirlo a tu cuenta.",
  "userProfile.emailAddressPage.removeResource.successMessage": "{{emailAddress}} se ha eliminado de tu cuenta.",
  "userProfile.mfaPage.formHint": "Selecciona un método para añadir.",
  "userProfile.mfaPhoneCodePage.removeResource.messageLine2": "Es posible que tu cuenta no sea tan segura. ¿Seguro que quieres continuar?",
  "userProfile.mfaPhoneCodePage.subtitle__availablePhoneNumbers":
    "Selecciona un número de teléfono existente para la verificación en dos pasos por SMS o añade uno nuevo.",
  "userProfile.mfaPhoneCodePage.successMessage2":
    "Guarda estos códigos de respaldo en un lugar seguro. Si pierdes el acceso a tu dispositivo de autenticación, puedes usarlos para iniciar sesión.",
  "userProfile.mfaTOTPPage.authenticatorApp.buttonAbleToScan__nonPrimary": "Escanea el código QR",
  "userProfile.mfaTOTPPage.authenticatorApp.infoText__ableToScan":
    "Configura un nuevo método de inicio de sesión en tu aplicación de autenticación y escanea el siguiente código QR para vincularla a tu cuenta.",
  "userProfile.mfaTOTPPage.authenticatorApp.infoText__unableToScan":
    "Configura un nuevo método de inicio de sesión en tu autenticador e introduce la clave que aparece abajo.",
  "userProfile.mfaTOTPPage.authenticatorApp.inputLabel__unableToScan1":
    "Asegúrate de tener activadas las contraseñas temporales o de un solo uso y termina de vincular tu cuenta.",
  "userProfile.mfaTOTPPage.authenticatorApp.inputLabel__unableToScan2":
    "Si tu autenticador admite URI TOTP, también puedes copiar el URI completo.",
  "userProfile.mfaTOTPPage.removeResource.messageLine2": "Es posible que tu cuenta no sea tan segura. ¿Seguro que quieres continuar?",
  "userProfile.mfaTOTPPage.verifySubtitle": "Introduce el código de verificación generado por tu autenticador",
  "userProfile.passkeyScreen.removeResource.messageLine1": "{{name}} se eliminará de esta cuenta.",
  "userProfile.passwordPage.checkboxInfoText__signOutOfOtherSessions":
    "Te recomendamos cerrar sesión en todos los dispositivos que puedan haber usado tu contraseña anterior.",
  "userProfile.passwordPage.readonly":
    "Ahora mismo no puedes cambiar tu contraseña porque solo puedes iniciar sesión mediante la conexión empresarial.",
  "userProfile.passwordPage.successMessage__set": "Tu contraseña se ha establecido.",
  "userProfile.phoneNumberPage.removeResource.successMessage": "{{phoneNumber}} se ha eliminado de tu cuenta.",
  "userProfile.phoneNumberPage.verifySubtitle": "Introduce el código de verificación enviado a {{identifier}}",
  "userProfile.profilePage.readonly": "La información de tu perfil proviene de la conexión empresarial y no se puede editar.",
  "userProfile.start.connectedAccountsSection.subtitle__disconnected": "Esta cuenta se ha desconectado.",
  "userProfile.start.passkeysSection.primaryButton": "Añadir una clave de acceso",
  "userProfile.start.web3WalletsSection.detailsAction__nonPrimary": "Establecer como principal",
  "userProfile.usernamePage.successMessage": "Tu nombre de usuario se ha actualizado.",
  "userProfile.web3WalletPage.removeResource.successMessage": "{{web3Wallet}} se ha eliminado de tu cuenta.",
  "userProfile.web3WalletPage.subtitle__availableWallets": "Selecciona una billetera web3 para conectarla a tu cuenta.",
  "userProfile.web3WalletPage.successMessage": "La billetera se ha añadido a tu cuenta.",
  "userProfile.web3WalletPage.web3WalletButtonsBlockButton": "{{provider|titleize}}",

  // --- organizations ---
  "organizationProfile.createDomainPage.subtitle":
    "Añade el dominio que quieres verificar. Los usuarios con correo en este dominio podrán unirse a la organización automáticamente o solicitar unirse.",
  "organizationProfile.invitePage.detailsTitle__inviteFailed":
    "No se pudieron enviar las invitaciones. Ya hay invitaciones pendientes para estas direcciones de correo: {{email_addresses}}.",
  "organizationProfile.membersPage.invitationsTab.autoInvitations.headerSubtitle":
    "Invita a usuarios conectando un dominio de correo con tu organización. Cualquiera que se registre con un correo de ese dominio podrá unirse a la organización en cualquier momento.",
  "organizationProfile.membersPage.requestsTab.autoSuggestions.headerSubtitle":
    "Los usuarios que se registren con un correo de ese dominio verán una sugerencia para solicitar unirse a tu organización.",
  "organizationProfile.navbar.description": "Gestiona tu organización.",
  "organizationProfile.profilePage.dangerSection.deleteOrganization.actionDescription":
    "Escribe \"{{organizationName}}\" abajo para continuar.",
  "organizationProfile.profilePage.dangerSection.deleteOrganization.messageLine1": "¿Seguro que quieres eliminar esta organización?",
  "organizationProfile.profilePage.dangerSection.deleteOrganization.successMessage": "Has eliminado la organización.",
  "organizationProfile.profilePage.dangerSection.leaveOrganization.actionDescription":
    "Escribe \"{{organizationName}}\" abajo para continuar.",
  "organizationProfile.profilePage.dangerSection.leaveOrganization.messageLine1":
    "¿Seguro que quieres abandonar esta organización? Perderás el acceso a ella y a sus aplicaciones.",
  "organizationProfile.removeDomainPage.successMessage": "{{domain}} se ha eliminado.",
  "organizationProfile.verifiedDomainPage.dangerTab.removeDomainSubtitle": "Elimina este dominio de tus dominios verificados",
  "organizationProfile.verifiedDomainPage.enrollmentTab.subtitle": "Elige cómo pueden unirse a la organización los usuarios de este dominio.",
  "organizationProfile.verifyDomainPage.formSubtitle": "Introduce el código de verificación enviado a tu correo electrónico",
  "organizationProfile.verifyDomainPage.subtitleVerificationCodeScreen":
    "Se envió un código de verificación a {{emailAddress}}. Introduce el código para continuar.",
  "organizationSwitcher.action__closeOrganizationSwitcher": "Cerrar el selector de organización",
  "organizationSwitcher.action__openOrganizationSwitcher": "Abrir el selector de organización",
  "taskChooseOrganization.chooseOrganization.action__createOrganization": "Crear una organización nueva",
  "taskChooseOrganization.chooseOrganization.action__invitationAccept": "Unirse",
  "taskChooseOrganization.chooseOrganization.action__suggestionsAccept": "Solicitar unirse",
  "taskChooseOrganization.chooseOrganization.subtitle": "Únete a una organización existente o crea una nueva",
  "taskChooseOrganization.chooseOrganization.subtitle__createOrganizationDisabled": "Únete a una organización existente",
  "taskChooseOrganization.chooseOrganization.suggestionsAcceptedLabel": "Pendiente de aprobación",
  "taskChooseOrganization.chooseOrganization.title": "Elige una organización",
  "taskChooseOrganization.createOrganization.formButtonReset": "Cancelar",
  "taskChooseOrganization.createOrganization.formButtonSubmit": "Continuar",
  "taskChooseOrganization.createOrganization.formFieldInputPlaceholder__name": "Mi organización",
  "taskChooseOrganization.createOrganization.formFieldInputPlaceholder__slug": "mi-organizacion",
  "taskChooseOrganization.createOrganization.formFieldLabel__name": "Nombre",
  "taskChooseOrganization.createOrganization.formFieldLabel__slug": "Slug",
  "taskChooseOrganization.createOrganization.subtitle": "Introduce los datos de tu organización para continuar",
  "taskChooseOrganization.createOrganization.title": "Configura tu organización",
  "taskChooseOrganization.organizationCreationDisabled.subtitle":
    "Contacta con el administrador de tu organización para recibir una invitación.",
  "taskChooseOrganization.signOut.actionLink": "Cerrar sesión",
  "taskChooseOrganization.signOut.actionText": "Sesión iniciada como {{identifier}}",

  // --- errors and password strength ---
  "unstable__errors.avatar_file_size_exceeded": "El archivo supera el límite de 10 MB. Elige un archivo más pequeño.",
  "unstable__errors.form_new_password_matches_current": "La nueva contraseña no puede ser igual a la actual.",
  "unstable__errors.form_password_pwned":
    "Esta contraseña apareció en una filtración de datos y no se puede usar. Elige otra contraseña.",
  "unstable__errors.form_password_untrusted__sign_in":
    "Parece que tu contraseña se ha visto comprometida o ya no es de confianza y no se puede usar. Continúa con otro método.",
  "unstable__errors.form_username_invalid_length":
    "Tu nombre de usuario debe tener entre {{min_length}} y {{max_length}} caracteres.",
  "unstable__errors.organization_not_found_or_unauthorized": "Ya no eres miembro de esta organización. Elige o crea otra.",
  "unstable__errors.organization_not_found_or_unauthorized_with_create_organization_disabled":
    "Ya no eres miembro de esta organización. Elige otra.",
  "unstable__errors.web3_missing_identifier": "No se encontró ninguna extensión de billetera Web3. Instala una para continuar.",
  "unstable__errors.zxcvbn.couldBeStronger": "Tu contraseña es válida, pero podría ser más segura. Prueba a añadir más caracteres.",
  "unstable__errors.zxcvbn.goodPassword": "Tu contraseña cumple todos los requisitos.",
  "unstable__errors.zxcvbn.notEnough": "Tu contraseña no es lo bastante segura.",
  "unstable__errors.zxcvbn.suggestions.allUppercase": "Pon en mayúscula algunas letras, pero no todas.",
  "unstable__errors.zxcvbn.suggestions.anotherWord": "Añade más palabras poco comunes.",
  "unstable__errors.zxcvbn.suggestions.associatedYears": "Evita años relacionados contigo.",
  "unstable__errors.zxcvbn.suggestions.capitalization": "Pon en mayúscula algo más que la primera letra.",
  "unstable__errors.zxcvbn.suggestions.dates": "Evita fechas y años relacionados contigo.",
  "unstable__errors.zxcvbn.suggestions.l33t": "Evita sustituciones de letras predecibles, como '@' por 'a'.",
  "unstable__errors.zxcvbn.suggestions.longerKeyboardPattern": "Usa patrones de teclado más largos y cambia de dirección varias veces.",
  "unstable__errors.zxcvbn.suggestions.noNeed": "Puedes crear contraseñas seguras sin símbolos, números ni mayúsculas.",
  "unstable__errors.zxcvbn.suggestions.pwned": "Si usas esta contraseña en otro sitio, deberías cambiarla.",
  "unstable__errors.zxcvbn.suggestions.recentYears": "Evita los años recientes.",
  "unstable__errors.zxcvbn.suggestions.repeated": "Evita repetir palabras y caracteres.",
  "unstable__errors.zxcvbn.suggestions.reverseWords": "Evita palabras comunes escritas al revés.",
  "unstable__errors.zxcvbn.suggestions.sequences": "Evita secuencias de caracteres comunes.",
  "unstable__errors.zxcvbn.suggestions.useWords": "Usa varias palabras, pero evita frases comunes.",
  "unstable__errors.zxcvbn.warnings.common": "Es una contraseña muy utilizada.",
  "unstable__errors.zxcvbn.warnings.commonNames": "Los nombres y apellidos comunes son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.dates": "Las fechas son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.extendedRepeat": "Los patrones repetidos como \"abcabcabc\" son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.keyPattern": "Los patrones de teclado cortos son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.namesByThemselves": "Un nombre o apellido por sí solo es fácil de adivinar.",
  "unstable__errors.zxcvbn.warnings.pwned": "Tu contraseña apareció en una filtración de datos en Internet.",
  "unstable__errors.zxcvbn.warnings.recentYears": "Los años recientes son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.sequences": "Las secuencias comunes como \"abc\" son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.similarToCommon": "Se parece a una contraseña muy utilizada.",
  "unstable__errors.zxcvbn.warnings.simpleRepeat": "Los caracteres repetidos como \"aaa\" son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.straightRow": "Las filas seguidas de teclas son fáciles de adivinar.",
  "unstable__errors.zxcvbn.warnings.topHundred": "Es una contraseña de uso frecuente.",
  "unstable__errors.zxcvbn.warnings.topTen": "Es una de las contraseñas más usadas.",
  "unstable__errors.zxcvbn.warnings.userInputs": "No debe contener datos personales ni datos de esta página.",
  "unstable__errors.zxcvbn.warnings.wordByItself": "Una sola palabra es fácil de adivinar.",

  // Server error codes (not in Clerk's English resource; see sr.ts): "usted"
  // forms, and three codes `esES` does not map.
  formFieldInputPlaceholder__username: "Introduce tu nombre de usuario",
  "signIn.start.actionLink__join_waitlist": "Únete a la lista de espera",
  "unstable__errors.captcha_invalid":
    "El registro no se completó porque falló la verificación de seguridad. Actualiza la página e inténtalo de nuevo o contacta con el soporte.",
  "unstable__errors.form_email_address_blocked":
    "No se admiten servicios de correo temporal. Usa tu correo electrónico habitual para crear una cuenta.",
  "unstable__errors.form_param_type_invalid": "El dato introducido no es del tipo correcto.",
  "unstable__errors.form_param_type_invalid__email_address": "Introduce un correo electrónico válido.",
  "unstable__errors.form_param_type_invalid__phone_number": "Introduce un número de teléfono válido.",
  "unstable__errors.not_allowed_access":
    "Este correo electrónico o número de teléfono no está permitido para registrarse. Puede deberse a '+', '=', '#' o '.' en tu correo, a un dominio de correo temporal o a una exclusión explícita. Si crees que es un error, contacta con el soporte.",
  "unstable__errors.organization_domain_exists_for_enterprise_connection":
    "Este dominio ya se usa para el inicio de sesión único (SSO) de tu organización.",
  "unstable__errors.phone_number_exists": "Este número de teléfono ya está en uso. Prueba con otro.",
};
