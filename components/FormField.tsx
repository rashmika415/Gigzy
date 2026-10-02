import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  ViewStyle,
  TextInputProps,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';

interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  /** Field label displayed above the input */
  label: string;
  /** Validation error message — triggers error styling when set */
  error?: string;
  /** Helper text shown below the input when there is no error */
  hint?: string;
  /** Optional Ionicon name rendered inside the input on the left */
  icon?: keyof typeof Ionicons.glyphMap;
  /** If true, the field is required (shows a red asterisk) */
  required?: boolean;
  /** Additional styles on the outer wrapper */
  containerStyle?: ViewStyle;
  /** Character count to display (e.g. "45 / 100") */
  charCount?: string;
}

export default function FormField({
  label,
  error,
  hint,
  icon,
  required,
  containerStyle,
  charCount,
  onFocus,
  onBlur,
  ...inputProps
}: FormFieldProps) {
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.errorBorder : colors.inputBorder,
      error ? colors.error : colors.inputBorderFocus,
    ],
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {/* Label */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.asterisk}> *</Text>}
        </Text>
        {charCount && (
          <Text style={styles.charCount}>{charCount}</Text>
        )}
      </View>

      {/* Input container */}
      <Animated.View
        style={[
          styles.inputContainer,
          error && styles.inputContainerError,
          { borderColor },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={error ? colors.error : colors.textMuted}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            inputProps.multiline && styles.multiline,
          ]}
          placeholderTextColor={colors.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...inputProps}
        />
      </Animated.View>

      {/* Error or hint */}
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  asterisk: {
    color: colors.error,
    fontWeight: '700',
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputContainerError: {
    backgroundColor: 'rgba(147, 0, 10, 0.06)',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    padding: 0,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
    flex: 1,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
