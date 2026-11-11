import Link from "next/link";
import { LEGAL, LegalPage, LegalSection, Mail } from "@/components/legal-page";

export const metadata = {
  title: "Terms of Service · TxtIt",
  description: "The terms that govern your use of TxtIt, the WhatsApp Business messaging platform by Piltovr.",
};

const SECTIONS = [
  ["about", "About these terms"],
  ["service", "The service"],
  ["accounts", "Accounts and workspaces"],
  ["whatsapp", "WhatsApp and Meta"],
  ["shared-number", "The shared TxtIt number"],
  ["consent", "Consent and acceptable use"],
  ["content", "Your content and data"],
  ["api", "API keys and webhooks"],
  ["fees", "Fees and Meta charges"],
  ["availability", "Availability and changes"],
  ["suspension", "Suspension and termination"],
  ["warranty", "Disclaimers"],
  ["liability", "Limitation of liability"],
  ["indemnity", "Indemnity"],
  ["law", "Governing law"],
  ["changes", "Changes to these terms"],
  ["contact", "Contact and grievances"],
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      sections={SECTIONS}
      intro={
        <p>
          These terms are an agreement between you and {LEGAL.entity} (&quot;{LEGAL.entity}&quot;, &quot;we&quot;, &quot;us&quot;), the provider of {LEGAL.product}. Please read them together with our <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      }
    >
      <LegalSection id="about" title="1. About these terms">
        <p>These terms apply when you use {LEGAL.product} at <strong>txtit.in</strong>, <strong>piltovr-wa.vercel.app</strong>, or any related site, app or API (together, the &quot;Service&quot;).</p>
        <p>By creating an account, connecting a WhatsApp number or using the Service, you agree to these terms. If you use the Service for a business or other organisation, you confirm that you have authority to accept these terms for it, and &quot;you&quot; includes that organisation.</p>
        <p>If you don&apos;t agree, don&apos;t use the Service.</p>
      </LegalSection>

      <LegalSection id="service" title="2. The service">
        <p>{LEGAL.product} is a software platform that helps businesses use the WhatsApp Business Platform (Cloud API). With it you can:</p>
        <ul>
          <li>connect a WhatsApp Business Account and phone number through Meta&apos;s Embedded Signup</li>
          <li>import and manage contacts and their consent</li>
          <li>create WhatsApp message templates and submit them to Meta for approval</li>
          <li>send messages and campaigns and follow their delivery status</li>
          <li>send messages from your own systems through our API and receive status webhooks</li>
        </ul>
        <p>We act as a technology provider. Messages are carried by WhatsApp, a service operated by Meta Platforms, Inc. and its affiliates (&quot;Meta&quot;). {LEGAL.product} is not affiliated with, endorsed by or sponsored by Meta or WhatsApp.</p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Accounts and workspaces">
        <ul>
          <li>You must be at least 18 years old and able to enter a binding contract.</li>
          <li>Give accurate account and business information, and keep it up to date.</li>
          <li>Keep your password and sessions secure. You are responsible for everything done through your account and workspace, including by people you invite.</li>
          <li>The workspace owner controls who can access the workspace and what roles they have.</li>
          <li>Tell us promptly at <Mail /> if you think your account has been accessed without permission.</li>
        </ul>
      </LegalSection>

      <LegalSection id="whatsapp" title="4. WhatsApp and Meta">
        <p>Your use of WhatsApp through the Service is also governed by Meta&apos;s terms and policies, which you must accept and follow. These include:</p>
        <ul>
          <li><a className="underline underline-offset-2" href="https://www.whatsapp.com/legal/business-terms" target="_blank" rel="noreferrer">WhatsApp Business Terms of Service</a></li>
          <li><a className="underline underline-offset-2" href="https://business.whatsapp.com/policy" target="_blank" rel="noreferrer">WhatsApp Business Messaging Policy</a></li>
          <li><a className="underline underline-offset-2" href="https://www.whatsapp.com/legal/commerce-policy" target="_blank" rel="noreferrer">WhatsApp Commerce Policy</a></li>
          <li><a className="underline underline-offset-2" href="https://www.facebook.com/legal/terms" target="_blank" rel="noreferrer">Meta Terms of Service</a></li>
        </ul>
        <p>When you connect your WhatsApp Business Account through Embedded Signup, you authorise {LEGAL.entity} to access and manage that account and phone number on your behalf. We use that access only to provide the Service, for example to send your messages, manage your templates, register your number and receive webhooks.</p>
        <p>Meta decides on template approval, display name approval, quality ratings, messaging limits, pricing, and whether to restrict or ban an account or number. We don&apos;t control those decisions and aren&apos;t responsible for them.</p>
        <p>The WhatsApp Business Account and phone number you connect remain yours. If you disconnect them or leave the Service, you keep them and can use them elsewhere.</p>
      </LegalSection>

      <LegalSection id="shared-number" title="5. The shared TxtIt number">
        <p>Until you connect your own number, we may let your workspace send messages from a shared number operated by {LEGAL.entity}. On that number:</p>
        <ul>
          <li>recipients see {LEGAL.entity}&apos;s or {LEGAL.product}&apos;s business name, not yours</li>
          <li>templates you create are submitted under our WhatsApp Business Account</li>
          <li>we may limit volume, review or reject templates, or stop your access to the shared number at any time, for example to protect its quality rating</li>
        </ul>
        <p>The shared number is meant for trials and getting started. Connect your own number for regular business messaging.</p>
      </LegalSection>

      <LegalSection id="consent" title="6. Consent and acceptable use">
        <p>You are responsible for every message sent from your workspace. You must:</p>
        <ul>
          <li>only message people who have given you clear permission (opt-in) to contact them on WhatsApp, and keep a record of that permission</li>
          <li>honour opt-outs promptly. When a contact replies STOP or otherwise opts out, the Service marks them as opted out and you must not message them again</li>
          <li>clearly identify your business in your messages</li>
          <li>comply with all laws that apply to you and your messages, including the Information Technology Act, 2000, the Digital Personal Data Protection Act, 2023, consumer protection law, and the laws of the countries your recipients are in</li>
        </ul>
        <p>You must not use the Service to:</p>
        <ul>
          <li>send spam, unsolicited bulk messages, or messages to purchased or scraped lists</li>
          <li>send content that is illegal, fraudulent, deceptive, harassing, hateful, sexually explicit or that infringes anyone&apos;s rights</li>
          <li>sell or promote goods and services that Meta&apos;s Commerce Policy prohibits</li>
          <li>impersonate any person or organisation</li>
          <li>send malware, phishing links, or requests for passwords, card numbers or one-time codes that aren&apos;t yours to request</li>
          <li>try to break, overload, reverse engineer or get around the security or limits of the Service</li>
          <li>resell the Service without our written agreement</li>
        </ul>
      </LegalSection>

      <LegalSection id="content" title="7. Your content and data">
        <p>&quot;Your content&quot; means the contacts, message templates, messages, files and other data you or your recipients put into the Service.</p>
        <ul>
          <li>You keep ownership of your content.</li>
          <li>You give us permission to store, process and transmit your content only as needed to provide, secure and support the Service, and to meet legal obligations.</li>
          <li>For personal data about your contacts, you are the data fiduciary (controller) and we process it on your behalf and on your instructions. You confirm that you have a lawful basis and any notices or consents needed to share it with us.</li>
          <li>Our <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link> explains how we handle personal data.</li>
          <li>You can delete your contacts in the Service at any time, and ask us at <Mail /> for a copy of your data. When your workspace is closed, we delete your content as described in the Privacy Policy.</li>
        </ul>
        <p>{LEGAL.entity} owns the Service, including its software, design and brand. These terms don&apos;t give you any rights to them except to use the Service as these terms allow. If you send us feedback, we may use it without any obligation to you.</p>
      </LegalSection>

      <LegalSection id="api" title="8. API keys and webhooks">
        <ul>
          <li>API keys act for your whole workspace. Keep them on your servers, never in browsers or mobile apps, and revoke any key you think has leaked.</li>
          <li>You are responsible for all requests made with your keys.</li>
          <li>Follow the limits and guidance in our <Link href="/developers" className="underline underline-offset-2">API reference</Link>. We may throttle or block traffic that exceeds them or harms the Service.</li>
          <li>If you set up a webhook, we will send message events, which can include phone numbers and message details, to the URL you choose. You are responsible for securing that endpoint and verifying our signatures.</li>
        </ul>
      </LegalSection>

      <LegalSection id="fees" title="9. Fees and Meta charges">
        <ul>
          <li><strong>Our fees.</strong> If you use a paid plan, you agree to pay the fees shown when you subscribe or agreed with us in writing. Fees are in Indian rupees unless stated otherwise, exclude taxes such as GST, and are non-refundable except where the law requires otherwise.</li>
          <li><strong>Meta&apos;s charges.</strong> Meta charges for WhatsApp messages according to its own pricing. For a number you connect yourself, Meta bills you directly through the payment method on your WhatsApp Business Account. If none is set up, Meta may block your messages.</li>
          <li>We may change our fees with at least 30 days&apos; notice. The change applies from your next billing period.</li>
        </ul>
      </LegalSection>

      <LegalSection id="availability" title="10. Availability and changes">
        <p>We work to keep the Service available and reliable, but it may sometimes be interrupted, for example for maintenance, because of outages at Meta, our hosting providers or the internet, or for reasons beyond our control.</p>
        <p>We improve the Service over time and may add, change or remove features. If we remove a feature you rely on in a way that materially reduces the Service, we will try to give you reasonable notice.</p>
      </LegalSection>

      <LegalSection id="suspension" title="11. Suspension and termination">
        <ul>
          <li>You can stop using the Service at any time and ask us to close your workspace by writing to <Mail />.</li>
          <li>We may suspend or close your account or workspace, or block specific messages or API keys, if you break these terms or Meta&apos;s policies, if your use creates a risk to the Service, to Meta&apos;s platform, to recipients or to us, if Meta requires it, or if the law requires it. Where it&apos;s reasonable, we will tell you first and give you a chance to fix the problem.</li>
          <li>When your workspace closes, your access ends, we stop sending messages for you, and we disconnect our app from your WhatsApp Business Account. Fees already due remain payable.</li>
          <li>Sections 7, 9, and 12 to 15 continue to apply after termination.</li>
        </ul>
      </LegalSection>

      <LegalSection id="warranty" title="12. Disclaimers">
        <p>The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent the law allows, we disclaim all warranties, whether express or implied, including warranties of merchantability, fitness for a particular purpose and non-infringement.</p>
        <p>We don&apos;t promise that any message will be delivered, delivered on time, or read, that Meta will approve a template, display name or account, or that the Service will be error-free or uninterrupted.</p>
      </LegalSection>

      <LegalSection id="liability" title="13. Limitation of liability">
        <p>To the fullest extent the law allows:</p>
        <ul>
          <li>We are not liable for any indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue, business, goodwill or data.</li>
          <li>We are not liable for any act or omission of Meta, including account restrictions, bans, pricing or outages.</li>
          <li>Our total liability for all claims relating to the Service is limited to the greater of the fees you paid us in the 12 months before the event giving rise to the claim, or ₹5,000.</li>
        </ul>
        <p>Nothing in these terms limits liability that cannot be limited under applicable law.</p>
      </LegalSection>

      <LegalSection id="indemnity" title="14. Indemnity">
        <p>You agree to defend and indemnify {LEGAL.entity} against claims, losses, fines and costs (including reasonable legal fees) arising from your content, your messages, your breach of these terms or of Meta&apos;s policies, or your breach of any law, including claims by message recipients, Meta or regulators.</p>
      </LegalSection>

      <LegalSection id="law" title="15. Governing law">
        <p>These terms are governed by the laws of India. The courts of competent jurisdiction in India have exclusive jurisdiction over any dispute arising from these terms or the Service. Before going to court, both sides will first try in good faith to resolve the dispute by writing to each other.</p>
      </LegalSection>

      <LegalSection id="changes" title="16. Changes to these terms">
        <p>We may update these terms from time to time. We will post the new version on this page and change the effective date. If a change is significant, we will also tell you by email or in the Service at least 15 days before it takes effect. If you keep using the Service after the change takes effect, you accept the updated terms.</p>
      </LegalSection>

      <LegalSection id="contact" title="17. Contact and grievances">
        <p>For questions, support, legal notices or complaints, including complaints about content sent through the Service, contact {LEGAL.entity} at <Mail />. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</p>
        <p>If you received a WhatsApp message from a business that uses {LEGAL.product} and want it to stop, reply STOP to that business, or write to us with the sender&apos;s number.</p>
      </LegalSection>
    </LegalPage>
  );
}
