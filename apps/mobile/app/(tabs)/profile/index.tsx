import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@inkmark/backend/convex/_generated/api";
import { useTheme } from "../../../src/theme";

export default function ProfileScreen() {
  const user = useQuery(api.users.me);
  const { signOut } = useAuthActions();
  const { colors, radii, typography } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  const formattedDate = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      {user === undefined ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.hanko} />
        </View>
      ) : user === null ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, typography.body, { color: colors.muted }]}>
            Not signed in.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <View style={styles.avatarPlaceholder}>
              <Text style={[styles.avatarInitial, typography.display, { color: colors.hanko }]}>
                {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={[styles.userName, typography.display, { color: colors.ink }]}>
                {user.name || "Reader"}
              </Text>
              {user.email && (
                <Text style={[styles.userEmail, typography.bodySm, { color: colors.muted }]}>
                  {user.email}
                </Text>
              )}
              {formattedDate && (
                <Text style={[styles.joinedText, typography.bodySm, { color: colors.muted }]}>
                  Member since {formattedDate}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={handleSignOut}
            disabled={isSigningOut}
            style={({ pressed }) => [
              styles.signOutButton,
              {
                borderColor: colors.border,
                borderRadius: radii.controls,
                backgroundColor: colors.card,
                opacity: isSigningOut ? 0.7 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Text style={[styles.signOutText, typography.display, { color: colors.destructive }]}>
                Sign out
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
  content: {
    gap: 24,
  },
  card: {
    padding: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(229, 65, 45, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 14,
  },
  joinedText: {
    fontSize: 13,
    marginTop: 4,
  },
  signOutButton: {
    height: 48,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: {
    fontSize: 15,
  },
});
