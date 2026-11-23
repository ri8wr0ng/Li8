import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "#/components/public-document";
import { publicPageHead } from "#/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    publicPageHead("/privacy", "Privacy policy", "How li8 uses, stores, and shares your data."),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicDocument title="Privacy policy">
      <p>li8 is a private notebook and a tracker for reading and watching progress.</p>

      <h2>Google sign-in</h2>
      <p>
        When you sign in with Google, li8 requests your basic Google profile and email address. li8
        uses your Google account identifier to recognize you when you return and stores your profile
        name and verified email address when Google supplies them. Your email also helps determine
        whether your account has access to optional features.
      </p>
      <p>
        li8 uses Google account data for sign-in, account management, and access to app features.
        li8 does not sell Google account data or use it for advertising. It does not request access
        to Gmail, Google Drive, or Google Calendar. li8’s use of information received from Google
        APIs follows the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including its Limited Use requirements.
      </p>

      <h2>Notes, Library, and device storage</h2>
      <p>
        li8 stores the notes, titles, progress, labels, and profile settings you add so you can use
        them across devices. Convex hosts this data and manages li8 sessions. li8 stores session
        information and preferences on your device. The web app also keeps a local copy of your
        notes and Library so you can view them offline.
      </p>
      <p>
        When you look up a title, your browser or the app sends the title search or media ID to
        AniList (manga, novels, anime and anime films) or TVmaze (TV series and reality shows).
      </p>

      <h2>Optional AI features</h2>
      <p>
        For accounts with AI access, li8 sends note and Library text through OpenRouter to create
        search embeddings. It also sends search queries, chat messages, and relevant content to
        OpenRouter and the model providers when you use AI search or Ask. These features use the
        content you enter in li8. Google sign-in profile data is kept out of those requests.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        You can delete notes and Library entries in li8. To request access to or deletion of your
        account and associated data, follow the instructions on the{" "}
        <Link to="/support">support page</Link>. li8 keeps account data while your account is
        active. Some records may remain for security, backup, or legal purposes after deletion.
      </p>
      <p>
        You can revoke li8’s access from your{" "}
        <a href="https://myaccount.google.com/connections">Google Account connections</a>. Revoking
        access in Google does not delete data already stored by li8.
      </p>
    </PublicDocument>
  );
}
