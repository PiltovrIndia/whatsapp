// Common WhatsApp template language codes.
// Full list: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/supported-languages
export const TEMPLATE_LANGUAGES = [
  ["en_US", "English (US)"],
  ["en_GB", "English (UK)"],
  ["en", "English"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["pa", "Punjabi"],
  ["ur", "Urdu"],
  ["ar", "Arabic"],
  ["es", "Spanish"],
  ["es_MX", "Spanish (Mexico)"],
  ["pt_BR", "Portuguese (Brazil)"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["id", "Indonesian"],
  ["ms", "Malay"],
  ["tr", "Turkish"],
  ["ru", "Russian"],
  ["zh_CN", "Chinese (Simplified)"],
  ["ja", "Japanese"],
  ["sw", "Swahili"],
];

export function languageLabel(code) {
  return TEMPLATE_LANGUAGES.find(([value]) => value === code)?.[1] || code;
}
