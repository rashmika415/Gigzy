import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const useNativeDriver = Platform.OS !== 'web';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Applied to the pressable surface (padding, background, gap). */
  style?: StyleProp<ViewStyle>;
  /** Applied to the animated wrapper (margins, flex sizing). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Scale while pressed. Keep subtle for large surfaces such as cards. */
  pressedScale?: number;
  /** Fade and rise in on first mount. */
  appear?: boolean;
  children: React.ReactNode;
}

/** Pressable that gives tactile feedback by shrinking slightly, instead of dimming. */
export default function PressableScale({ style, containerStyle, pressedScale = 0.98, appear = false, children, onPressIn, onPressOut, ...props }: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [entrance] = useState(() => new Animated.Value(appear ? 0 : 1));

  useEffect(() => {
    if (!appear) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) entrance.setValue(1);
      else Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver }).start();
    });
    return () => { cancelled = true; };
  }, [appear, entrance]);

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver, speed: 40, bounciness: 4 }).start();
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[containerStyle, { opacity: entrance, transform: [{ scale }, { translateY }] }]}>
      <Pressable
        {...props}
        style={style}
        onPressIn={(event) => { if (!props.disabled) springTo(pressedScale); onPressIn?.(event); }}
        onPressOut={(event) => { springTo(1); onPressOut?.(event); }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
