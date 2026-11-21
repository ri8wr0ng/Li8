import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "#/components/public-document";
import { publicPageHead } from "#/lib/seo";

export const Route = createFileRoute("/support")({
  head: () =>
    publicPageHead("/support", "Support", "Get help with li8 or request account deletion."),
  component: SupportPage,
});

function SupportPage() {
  return (
    <PublicDocument title="Support">
      <h2>Contact the maintainer</h2>
      <p>
        Contact the li8 maintainer through the contact details on the
        <a href="https://github.com/sharull9"> maintainer’s GitHub profile</a>. For a general bug
        report, you can also use the{" "}
        <a href="https://github.com/sharull9/ai-notes/issues">project issue tracker</a>.
      </p>

      <h2>Request account or data deletion</h2>
      <p>
        Contact the maintainer privately and say that you want to delete your li8 account or
        specific data. The maintainer may ask you to confirm the Google email address you used to
        sign in, so they can verify that you own the account. Keep your email address, passwords,
        and sign-in codes out of public GitHub issues.
      </p>
      <p>
        Read the <Link to="/privacy">privacy policy</Link> for details about what li8 stores and how
        to revoke Google access.
      </p>
    </PublicDocument>
  );
}
