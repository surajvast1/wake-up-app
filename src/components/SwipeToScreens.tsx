import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

interface SwipeToScreensProps {
  /** Target when the user swipes LEFT (finger moves right → left). */
  leftScreen?: string;
  /** Target when the user swipes RIGHT (finger moves left → right). */
  rightScreen?: string;
  leftScreenParams?: Record<string, unknown>;
  rightScreenParams?: Record<string, unknown>;
  /**
   * Still accepted for backwards compatibility but the gesture is now
   * full-screen in both directions so the reverse drag feels identical
   * to the forward one.
   */
  fromEdge?: "left" | "right";
  edgeWidth?: number;
  commitFraction?: number;
  commitVelocity?: number;
  /** How many px of horizontal movement before the pan activates. */
  activeOffset?: number;
  /** How many px of vertical movement before the pan gives up. */
  failOffsetY?: number;
  children: React.ReactNode;
}

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Pan-driven horizontal swipe that navigates to sibling drawer screens.
 *
 * Design note:
 * We deliberately DO NOT animate the current screen off-screen. Because drawer
 * navigation in React Navigation swaps routes instantly (no inter-route
 * animation), animating to ±SCREEN_W would briefly show a blank area before
 * the new screen renders. Instead we:
 *   1. Let the user drag the content with their thumb (thumb-follow feel).
 *   2. On release, *always* spring back to translateX=0.
 *   3. If the gesture passed the distance/velocity threshold, fire jumpTo
 *      during the spring-back — the drawer switches routes while the current
 *      view is already safely at x=0.
 * Result: no blank screen, navigation feels snappy, and even if something
 * goes wrong with the focus lifecycle, the view is already back at 0.
 */
const SwipeToScreens: React.FC<SwipeToScreensProps> = ({
  leftScreen,
  rightScreen,
  leftScreenParams,
  rightScreenParams,
  commitFraction = 0.22,
  commitVelocity = 550,
  activeOffset = 20,
  failOffsetY = 16,
  children,
}) => {
  const navigation = useNavigation<any>();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const lockedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUnlockTimer = useCallback(() => {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  const unlockSoon = useCallback(() => {
    clearUnlockTimer();
    unlockTimerRef.current = setTimeout(() => {
      lockedRef.current = false;
    }, 400);
  }, [clearUnlockTimer]);

  useFocusEffect(
    useCallback(() => {
      translateX.value = 0;
      lockedRef.current = false;
      clearUnlockTimer();
      return () => {
        translateX.value = 0;
        lockedRef.current = false;
        clearUnlockTimer();
      };
    }, [clearUnlockTimer, translateX])
  );

  useEffect(() => {
    return () => {
      clearUnlockTimer();
    };
  }, [clearUnlockTimer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const jumpTo = useCallback(
    (target: string, params?: Record<string, unknown>) => {
      try {
        const nav = navigation as {
          jumpTo?: (name: string, p?: object) => void;
        };
        if (typeof nav.jumpTo === "function") {
          nav.jumpTo(target, params ?? {});
        } else {
          navigation.navigate(target as never, (params ?? {}) as never);
        }
      } catch {}
    },
    [navigation]
  );

  const doCommit = useCallback(
    (direction: "left" | "right") => {
      if (lockedRef.current) return;
      const target = direction === "right" ? rightScreen : leftScreen;
      if (!target) return;
      lockedRef.current = true;
      const params =
        direction === "right" ? rightScreenParams : leftScreenParams;
      jumpTo(target, params);
      unlockSoon();
    },
    [
      jumpTo,
      leftScreen,
      leftScreenParams,
      rightScreen,
      rightScreenParams,
      unlockSoon,
    ]
  );

  const pan = useMemo(() => {
    return Gesture.Pan()
      /* Only activate on a confident horizontal swipe — small horizontal
       * scrolls on inner lists (e.g. CategoryTabs) won't steal the gesture. */
      .activeOffsetX([-activeOffset, activeOffset])
      /* If the touch starts vertical, let the underlying ScrollView take it. */
      .failOffsetY([-failOffsetY, failOffsetY])
      .onStart(() => {
        startX.value = translateX.value;
      })
      .onUpdate((e) => {
        const raw = startX.value + e.translationX;
        let next = raw;
        if (raw > 0 && !rightScreen) next = raw * 0.22;
        else if (raw < 0 && !leftScreen) next = raw * 0.22;
        /* Keep it on-screen even at peak drag so there's never blank. */
        if (next > SCREEN_W * 0.5) next = SCREEN_W * 0.5;
        if (next < -SCREEN_W * 0.5) next = -SCREEN_W * 0.5;
        translateX.value = next;
      })
      .onEnd((e) => {
        const threshold = SCREEN_W * commitFraction;
        const goingRight = e.translationX > 0;
        const goingLeft = e.translationX < 0;
        const fastEnough = Math.abs(e.velocityX) > commitVelocity;
        const farEnough = Math.abs(e.translationX) > threshold;

        if (goingRight && rightScreen && (farEnough || fastEnough)) {
          runOnJS(doCommit)("right");
        } else if (goingLeft && leftScreen && (farEnough || fastEnough)) {
          runOnJS(doCommit)("left");
        }
        translateX.value = withSpring(0, {
          damping: 22,
          stiffness: 210,
          mass: 0.55,
          overshootClamping: true,
        });
      });
  }, [
    activeOffset,
    commitFraction,
    commitVelocity,
    doCommit,
    failOffsetY,
    leftScreen,
    rightScreen,
    startX,
    translateX,
  ]);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

export default SwipeToScreens;
