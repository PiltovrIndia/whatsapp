import Link from "next/link";
import { LEGAL, LegalPage, LegalSection, Mail } from "@/components/legal-page";

export const metadata = {
  title: "Privacy Policy · TxtIt",
  description: "How Piltovr collects, uses, shares and protects personal data in TxtIt.",
};

const SECTIONS = [
  ["scope", "Who this policy covers"],
  ["collect", "What we collect"],
  ["use", "How we use it"],
  ["meta", "Data from Meta and WhatsApp"],
  ["share", "Who we share it with"],
  ["retention", "How long we keep it"],
  ["security", "How we protect it"],
  ["cookies", "Cookies"],
  ["rights", "Your rights"],
  ["deletion", "Data deletion"],
  ["transfers", "Where data is stored"],
  ["children", "Children"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact and grievances"],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      sections={SECTIONS}
      intro={
        <p>
          This policy explains how {LEGAL.entity} (&quot;we&quot;, &quot;us&quot;) collects, uses, shares and protects personal data when you use {LEGAL.product} at txtit.in, piltovr-wa.vercel.app and our API (the &quot;Service&quot;). It should be read with our <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>.
        </p>
      }
    >
      <LegalSection id="scope" title="1. Who this policy covers">
        <ul>
          <li><strong>Customers and their team members</strong>: people who sign up for or use a {LEGAL.product} workspace. For their data, {LEGAL.entity} is the data fiduciary (controller).</li>
          <li><strong>Contacts</strong>: people our customers message on WhatsApp. Each customer decides who to message and why, so the customer is the data fiduciary for its contacts&apos; data. We process that data on the customer&apos;s behalf, only on their instructions. If you are a contact, please also read the privacy notice of the business that messaged you.</li>
          <li><strong>Visitors</strong> to our website.</li>
        </ul>
      </LegalSection>

      <LegalSection id="collect" title="2. What we collect">
        <p><strong>Account and workspace data.</strong> Your name, email address, password (stored only as a salted hash), organisation name, role, and the team members you invite.</p>
        <p><strong>WhatsApp Business account data.</strong> When you connect WhatsApp through Meta&apos;s Embedded Signup, we receive your Meta business ID, WhatsApp Business Account ID and name, phone number ID, display phone number, verified business name, quality rating, messaging limits and an access token that lets us act on that account.</p>
        <p><strong>Contact data</strong> that customers import or that arrives through WhatsApp: names, phone numbers, any custom fields the customer adds, list membership, opt-in and opt-out status, and the WhatsApp profile name a contact shares with the business.</p>
        <p><strong>Messages and templates.</strong> Message templates, the content and variables of messages sent, media links, replies and other inbound messages, and delivery statuses (sent, delivered, read, failed) with any error details from Meta.</p>
        <p><strong>API and webhook data.</strong> API key fingerprints (we never store full keys), webhook URLs, and logs of API requests and webhook deliveries.</p>
        <p><strong>Technical data.</strong> IP address, browser and device information, and timestamps, recorded in security and server logs, plus the session cookie described below.</p>
        <p><strong>Communications.</strong> What you send us when you contact support.</p>
      </LegalSection>

      <LegalSection id="use" title="3. How we use it">
        <ul>
          <li>to provide the Service: create workspaces, send and receive WhatsApp messages, manage templates, show delivery status and run campaigns and API requests</li>
          <li>to connect and manage the WhatsApp Business accounts our customers authorise</li>
          <li>to enforce opt-outs, so contacts who reply STOP are not messaged again</li>
          <li>to secure the Service, prevent fraud and abuse, and enforce our Terms and Meta&apos;s policies</li>
          <li>to provide support and send service messages, such as security alerts and changes to our terms</li>
          <li>to fix problems and improve the Service</li>
          <li>to meet legal obligations</li>
        </ul>
        <p>We do not sell personal data. We do not use contacts&apos; data or message content for advertising, and we do not use one customer&apos;s data for another customer.</p>
      </LegalSection>

      <LegalSection id="meta" title="4. Data from Meta and WhatsApp">
        <p>We use data we receive through Meta&apos;s platform (Embedded Signup, the WhatsApp Business Management API and the WhatsApp Cloud API) only to provide the Service to the customer who authorised it, in line with the <a className="underline underline-offset-2" href="https://developers.facebook.com/terms" target="_blank" rel="noreferrer">Meta Platform Terms</a>.</p>
        <ul>
          <li>We request only the permissions needed to manage WhatsApp templates, phone numbers and messages: <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code>.</li>
          <li>Access tokens are encrypted at rest and used only by our servers.</li>
          <li>We don&apos;t share platform data with third parties except as described below, and never sell it or use it to build profiles for advertising.</li>
          <li>You can remove our access at any time by disconnecting in {LEGAL.product}, or in Meta Business Settings under Integrations → Connected apps.</li>
        </ul>
      </LegalSection>

      <LegalSection id="share" title="5. Who we share it with">
        <ul>
          <li><strong>Meta (WhatsApp).</strong> Messages, templates and recipient numbers are sent to Meta so WhatsApp can deliver them. Meta handles that data under its own terms and privacy policy.</li>
          <li><strong>Service providers</strong> that host and run the Service for us, such as cloud hosting and database providers. They may process data only on our instructions.</li>
          <li><strong>Endpoints you choose.</strong> If a customer sets up a webhook, we send message events to the URL the customer provides.</li>
          <li><strong>Within your workspace.</strong> Team members of a workspace can see that workspace&apos;s data according to their role.</li>
          <li><strong>Legal and safety.</strong> When the law requires it, to respond to valid requests from authorities, or to protect the rights, safety and property of our users, the public or us.</li>
          <li><strong>Business changes.</strong> If {LEGAL.entity} is involved in a merger, acquisition or sale of assets, data may transfer as part of it, subject to this policy.</li>
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="6. How long we keep it">
        <ul>
          <li>Account, workspace, contact and message data is kept while the workspace is active.</li>
          <li>Customers can delete contacts at any time. A deleted contact&apos;s record is removed straight away. Records of messages already sent to that number stay in the workspace&apos;s history until the workspace is closed, or until deleted on request.</li>
          <li>When a workspace is closed, we delete or anonymise its data within 30 days, except where we must keep some records longer by law (for example invoices and tax records) or to resolve disputes.</li>
          <li>Security and server logs are kept for a limited period, normally no more than 180 days.</li>
          <li>Backups are overwritten on a rolling basis, so deleted data may remain in backups for a short time before it is removed.</li>
        </ul>
      </LegalSection>

      <LegalSection id="security" title="7. How we protect it">
        <ul>
          <li>All traffic to the Service uses HTTPS.</li>
          <li>Passwords are stored as salted scrypt hashes, and API keys as one-way fingerprints.</li>
          <li>WhatsApp access tokens and webhook signing secrets are encrypted with AES-256-GCM.</li>
          <li>Workspaces are isolated from each other, and access within a workspace is role-based.</li>
          <li>Webhooks we send are signed so receivers can verify they came from us.</li>
        </ul>
        <p>No system is perfectly secure. If a personal data breach affects you, we will notify you and the authorities as the law requires.</p>
      </LegalSection>

      <LegalSection id="cookies" title="8. Cookies">
        <p>We use one essential cookie, which keeps you signed in. We don&apos;t use advertising or third-party tracking cookies. When you use Embedded Signup, Meta&apos;s login window may set its own cookies under Meta&apos;s policies.</p>
      </LegalSection>

      <LegalSection id="rights" title="9. Your rights">
        <p>Under the Digital Personal Data Protection Act, 2023 and other laws that apply to you, you may have the right to:</p>
        <ul>
          <li>get a summary of the personal data we hold about you and how it is processed</li>
          <li>have inaccurate data corrected or completed</li>
          <li>have your data erased</li>
          <li>withdraw consent where processing is based on consent</li>
          <li>nominate someone to exercise these rights for you</li>
          <li>raise a grievance with us, and then with the Data Protection Board of India</li>
        </ul>
        <p>To exercise them, write to <Mail />. We may need to verify your identity first. If you are a contact of one of our customers, we will pass your request to that customer or help them respond, because they decide how your data is used.</p>
      </LegalSection>

      <LegalSection id="deletion" title="10. Data deletion">
        <p>To delete your data from {LEGAL.product}:</p>
        <ul>
          <li><strong>Customers:</strong> email <Mail /> from your account&apos;s email address with the subject &quot;Delete my account&quot; and the workspace name. We will close the workspace, disconnect our app from your WhatsApp Business Account and delete the workspace&apos;s data within 30 days, as described in section 6. We will confirm by email when it is done.</li>
          <li><strong>Removing Meta access only:</strong> in Meta Business Settings, go to Integrations → Connected apps, choose {LEGAL.entity}&apos;s app and remove it. We will then no longer be able to access your WhatsApp Business Account.</li>
          <li><strong>Contacts:</strong> reply STOP to the business that messaged you to stop further messages. To have your data deleted, ask that business, or email <Mail /> with your phone number and the business&apos;s WhatsApp number, and we will help.</li>
        </ul>
      </LegalSection>

      <LegalSection id="transfers" title="11. Where data is stored">
        <p>Our servers and service providers may be located in India or other countries. Messages also pass through Meta&apos;s infrastructure, which operates worldwide. Where data is transferred outside India, we do so as permitted by Indian law and protect it as described in this policy.</p>
      </LegalSection>

      <LegalSection id="children" title="12. Children">
        <p>The Service is for businesses and is not meant for anyone under 18. We do not knowingly collect personal data from children for our own purposes. Customers must not use the Service to message children without verifiable parental consent where the law requires it.</p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes to this policy">
        <p>We may update this policy from time to time. We will post the new version here and change the effective date, and we will tell customers about significant changes by email or in the Service before they take effect.</p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact and grievances">
        <p>For privacy questions, requests or complaints, contact {LEGAL.entity} at <Mail />. We acknowledge grievances within 24 hours and aim to resolve them within 15 days.</p>
      </LegalSection>
    </LegalPage>
  );
}
