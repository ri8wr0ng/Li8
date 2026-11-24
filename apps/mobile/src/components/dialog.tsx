import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";
import { PressableScale } from "./pressable-scale";

export type DialogButton = {
  text: string;
  /** "cancel" is the quiet outline button; "destructive" is filled red. */
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
};

let nextId = 1;
let queue: DialogRequest[] = [];
const listeners = new Set<(queue: DialogRequest[]) => void>();

function emit() {
  for (const listener of listeners) listener(queue);
}

/**
 * The app's own alert, styled like the rest of the app instead of the system
 * dialog. Same shape as `Alert.alert`: no buttons means a single "OK". Calls
 * made while one is open wait their turn.
 */
export const dialog = {
  alert(title: string, message?: string, buttons?: DialogButton[]) {
    queue = [
      ...queue,
      { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] },
    ];
    emit();
  },
};

function remove(id: number) {
  queue = queue.filter((request) => request.id !== id);
  emit();
}

/** Mount once near the root, after the app content. */
export function DialogHost() {
  const { colors, radii, typography } = useTheme();
  const [pending, setPending] = useState(queue);

  useEffect(() => {
    listeners.add(setPending);
    return () => {
      listeners.delete(setPending);
    };
  }, []);

  const current = pending[0];

  const close = (button?: DialogButton) => {
    if (current) remove(current.id);
    void Promise.resolve(button?.onPress?.()).catch((err: unknown) => console.error(err));
  };

  // Back button and backdrop tap close without running any button, so they never undo or delete.
  const dismiss = () => close();
  const stacked = (current?.buttons.length ?? 0) > 2;

  return (
    <Modal
      visible={current !== undefined}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss">
        {current ? (
          <Pressable
            key={current.id}
            accessibilityRole="alert"
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.box,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.title, typography.display, { color: colors.ink }]}>
              {current.title}
            </Text>
            {current.message ? (
              <Text style={[typography.bodySm, { color: colors.muted }]}>{current.message}</Text>
            ) : null}
            <View style={[styles.actions, stacked && styles.actionsStacked]}>
              {current.buttons.map((button, index) => {
                const quiet = button.style === "cancel";
                const fill = button.style === "destructive" ? colors.destructive : colors.hanko;
                return (
                  <PressableScale
                    key={`${button.text}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={button.text}
                    onPress={() => close(button)}
                    style={[
                      styles.button,
                      { borderRadius: radii.controls },
                      quiet
                        ? { borderWidth: 1, borderColor: colors.border }
                        : { backgroundColor: fill },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: quiet ? colors.muted : "#FFFFFF" },
                        !quiet && styles.buttonTextStrong,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  box: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 18,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 10,
  },
  actionsStacked: {
    flexDirection: "column-reverse",
    alignItems: "stretch",
  },
  button: {
    minHeight: 40,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  buttonTextStrong: {
    fontWeight: "600",
  },
});
