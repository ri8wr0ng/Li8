import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "#/components/public-document";
import { publicPageHead } from "#/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => publicPageHead("/terms", "Terms of service", "The terms for using li8."),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicDocument title="Terms of service">
      <p>By using li8, you agree to these terms.</p>

      <h2>Your account</h2>
      <p>
        Use a Google account you control. Keep your account and devices secure, and contact
        <Link to="/support"> support</Link> if you suspect someone else has accessed your li8
        account.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of your notes and other content. You give li8 permission to store and
        process your content to provide the features described in the{" "}
        <Link to="/privacy">privacy policy</Link>. Only add content that you have the right to use.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Follow applicable law and respect other people’s rights. Do not attempt to access another
        person’s account or data, bypass security controls, or disrupt the service. li8 may suspend
        access to protect the service or its users.
      </p>

      <h2>Availability</h2>
      <p>
        li8 is provided as available and features may change. Third-party services may be
        unavailable, and AI responses can contain errors. Check information that matters to you and
        keep your own copies of important notes.
      </p>
    </PublicDocument>
  );
}
