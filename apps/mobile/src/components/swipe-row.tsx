import { useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { haptics } from "../haptics";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

export type SwipeAction = {
  key: string;
  label: string;
  icon: FeatherIconName;
  color: string;
  onPress: () => void;
  destructive?: boolean;
};

type SwipeRowProps = {
  children: ReactNode;
  leading?: SwipeAction[];
  trailing?: SwipeAction[];
  borderRadius: number;
  accessibilityLabel?: string;
  accessibilityActions?: ComponentProps<typeof View>["accessibilityActions"];
  onAccessibilityAction?: ComponentProps<typeof View>["onAccessibilityAction"];
  onAccessibilityTap?: () => void;
};

let openSwipeable: SwipeableMethods | null = null;

export function SwipeRow({
  children,
  leading = [],
  trailing = [],
  borderRadius,
  accessibilityLabel,
  accessibilityActions: childAccessibilityActions = [],
  onAccessibilityAction: onChildAccessibilityAction,
  onAccessibilityTap,
}: SwipeRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const actions = [...leading, ...trailing];

  useEffect(
    () => () => {
      if (openSwipeable === swipeableRef.current) openSwipeable = null;
    },
    [],
  );

  const runAction = useCallback((action: SwipeAction) => {
    haptics.tap();
    swipeableRef.current?.close();
    action.onPress();
  }, []);
  const accessibilityActions = [
    ...childAccessibilityActions,
    ...actions.map((action) => ({ name: `swipe-${action.key}`, label: action.label })),
  ];

  const renderActions = (items: SwipeAction[], side: "leading" | "trailing") => (
    <View
      style={[
        styles.actionGroup,
        side === "leading"
          ? { borderTopLeftRadius: borderRadius, borderBottomLeftRadius: borderRadius }
          : { borderTopRightRadius: borderRadius, borderBottomRightRadius: borderRadius },
      ]}
    >
      {items.map((action, index) => {
        const outerCorner = side === "leading" ? index === 0 : index === items.length - 1;
        return (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => runAction(action)}
            style={[
              styles.action,
              { backgroundColor: action.color },
              outerCorner && side === "leading"
                ? { borderTopLeftRadius: borderRadius, borderBottomLeftRadius: borderRadius }
                : null,
              outerCorner && side === "trailing"
                ? { borderTopRightRadius: borderRadius, borderBottomRightRadius: borderRadius }
                : null,
            ]}
          >
            <Feather name={action.icon} size={20} color="#FFFFFF" />
            <Text style={styles.actionLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (actions.length === 0) return children;

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={40}
      rightThreshold={40}
      dragOffsetFromLeft={20}
      dragOffsetFromRight={-20}
      renderLeftActions={leading.length ? () => renderActions(leading, "leading") : undefined}
      renderRightActions={trailing.length ? () => renderActions(trailing, "trailing") : undefined}
      onSwipeableOpen={() => {
        if (openSwipeable && openSwipeable !== swipeableRef.current) openSwipeable.close();
        openSwipeable = swipeableRef.current;
        haptics.select();
      }}
      onSwipeableClose={() => {
        if (openSwipeable === swipeableRef.current) openSwipeable = null;
      }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={accessibilityActions}
        onAccessibilityTap={onAccessibilityTap}
        onAccessibilityAction={(event) => {
          onChildAccessibilityAction?.(event);
          const action = actions.find(
            (item) => `swipe-${item.key}` === event.nativeEvent.actionName,
          );
          if (action) runAction(action);
        }}
        style={{ borderRadius, overflow: "hidden" }}
      >
        {children}
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionGroup: {
    flexDirection: "row",
    overflow: "hidden",
  },
  action: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
