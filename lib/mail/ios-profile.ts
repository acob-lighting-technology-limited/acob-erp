import "server-only"
import crypto from "crypto"
import { MAIL_CLIENT_SETTINGS } from "./client-settings"

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Stable per-mailbox UUID, so reinstalling replaces the account instead of adding a second one. */
function stableUuid(seed: string): string {
  const h = crypto.createHash("sha256").update(seed).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase()
}

/**
 * An Apple configuration profile (.mobileconfig) that adds the mailbox to the
 * iPhone / iPad / Mac Mail app with every server setting filled in. The
 * password is deliberately left out — iOS asks for it during installation, so
 * it never passes through Matrix.
 */
export function buildIosMailProfile(params: { email: string; displayName: string }): string {
  const email = params.email.trim().toLowerCase()
  const name = xmlEscape(params.displayName.trim() || email)
  const address = xmlEscape(email)
  const host = xmlEscape(MAIL_CLIENT_SETTINGS.host)
  const id = crypto.createHash("sha256").update(email).digest("hex").slice(0, 16)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>EmailAccountDescription</key>
      <string>ACOB Work Email</string>
      <key>EmailAccountName</key>
      <string>${name}</string>
      <key>EmailAccountType</key>
      <string>EmailTypeIMAP</string>
      <key>EmailAddress</key>
      <string>${address}</string>
      <key>IncomingMailServerAuthentication</key>
      <string>EmailAuthPassword</string>
      <key>IncomingMailServerHostName</key>
      <string>${host}</string>
      <key>IncomingMailServerPortNumber</key>
      <integer>${MAIL_CLIENT_SETTINGS.imapPort}</integer>
      <key>IncomingMailServerUseSSL</key>
      <true/>
      <key>IncomingMailServerUsername</key>
      <string>${address}</string>
      <key>OutgoingMailServerAuthentication</key>
      <string>EmailAuthPassword</string>
      <key>OutgoingMailServerHostName</key>
      <string>${host}</string>
      <key>OutgoingMailServerPortNumber</key>
      <integer>${MAIL_CLIENT_SETTINGS.smtpPort}</integer>
      <key>OutgoingMailServerUseSSL</key>
      <true/>
      <key>OutgoingMailServerUsername</key>
      <string>${address}</string>
      <key>OutgoingPasswordSameAsIncomingPassword</key>
      <true/>
      <key>PreventMove</key>
      <false/>
      <key>PreventAppSheet</key>
      <false/>
      <key>SMIMEEnabled</key>
      <false/>
      <key>allowMailRecentsSync</key>
      <true/>
      <key>PayloadDisplayName</key>
      <string>ACOB Work Email</string>
      <key>PayloadIdentifier</key>
      <string>com.acoblighting.matrix.mail.${id}.account</string>
      <key>PayloadType</key>
      <string>com.apple.mail.managed</string>
      <key>PayloadUUID</key>
      <string>${stableUuid(`${email}:account`)}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Adds your ACOB work email (${address}) to the Mail app. You will be asked for your mailbox password.</string>
  <key>PayloadDisplayName</key>
  <string>ACOB Work Email</string>
  <key>PayloadIdentifier</key>
  <string>com.acoblighting.matrix.mail.${id}</string>
  <key>PayloadOrganization</key>
  <string>ACOB Lighting Technology Limited</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${stableUuid(`${email}:profile`)}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`
}
