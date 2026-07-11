const CONTACT_EMAIL = "gday@danferg.com";

interface ContactMessage {
  subject: string;
  body: string;
}

export function createContactMailto({ subject, body }: ContactMessage) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
