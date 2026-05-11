export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "sans-serif", lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> May 2026</p>

      <p>
        This application (&quot;Bhutan&apos;s Marketing&quot;) is used internally by OMG Experience Co., Ltd. to manage and publish
        social media content on Facebook Pages and Instagram Business accounts.
      </p>

      <h2>Data We Collect</h2>
      <p>
        We collect Facebook and Instagram OAuth tokens solely for the purpose of publishing content on behalf of
        authorized administrators. These tokens are stored encrypted and are never shared with third parties.
      </p>

      <h2>How We Use Your Data</h2>
      <ul>
        <li>Publishing posts to Facebook Pages and Instagram Business accounts</li>
        <li>Reading page insights and engagement metrics for internal reporting</li>
      </ul>

      <h2>Data Retention</h2>
      <p>
        Access tokens are stored only as long as necessary to perform publishing operations. Administrators may
        disconnect their accounts at any time via the application settings.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        This application uses the Meta Graph API. Use of Facebook and Instagram is subject to
        Meta&apos;s own privacy policy at <a href="https://www.facebook.com/privacy/policy/">facebook.com/privacy/policy</a>.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy-related questions, contact us at: <a href="mailto:cargo@omgexp.com">cargo@omgexp.com</a>
      </p>
    </main>
  );
}
