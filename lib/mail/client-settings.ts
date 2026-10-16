/**
 * Settings staff type (or Matrix fills in) to use their @org.acoblighting.com
 * mailbox in a phone or desktop mail app.
 *
 * The server is the hosting server's own name, not org.acoblighting.com: the
 * server only holds a certificate for *.web-hosting.com, so connecting by our
 * domain name makes apps warn "certificate doesn't match". This name matches
 * and Namecheap keeps it valid — no certificate of ours to renew.
 */
export const MAIL_CLIENT_HOST = process.env.NEXT_PUBLIC_MAIL_CLIENT_HOST ?? "premium21.web-hosting.com"

export const MAIL_CLIENT_SETTINGS = {
  host: MAIL_CLIENT_HOST,
  imapPort: 993,
  smtpPort: 465,
  security: "SSL/TLS",
} as const

/** Webmail in a browser, for anyone who would rather not use an app. */
export const WEBMAIL_URL = process.env.NEXT_PUBLIC_WEBMAIL_URL ?? "https://webmail-p21.web-hosting.com/"
