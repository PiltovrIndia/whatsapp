export const CONTACT_TEMPLATE_FILE_NAME = "engage-contact-import-template.xlsx";

export const CONTACT_TEMPLATE_HEADERS = [
  "First Name",
  "Last Name",
  "Phone",
  "Email",
  "Company",
  "Opt In",
];

export const CONTACT_TEMPLATE_INSTRUCTIONS = [
  ["Field", "Required", "Accepted format", "Notes"],
  ["First Name", "No", "Text", "Customer's given name"],
  ["Last Name", "No", "Text", "Customer's family name"],
  ["Phone", "Yes", "+919876543210", "Include the country code; 8 to 15 digits"],
  ["Email", "No", "name@example.com", "Invalid email values are ignored"],
  ["Company", "No", "Text", "Business or organization name"],
  ["Opt In", "Yes", "yes / true / 1 / opted in", "Use an accepted value only when the customer has consented"],
];
