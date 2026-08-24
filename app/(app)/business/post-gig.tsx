import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../../constants/theme';
import { CATEGORY_LABEL, Category } from '../../../data/mockData';
import { useBusinessGigs } from '../../../context/BusinessGigsContext';

const CATEGORIES: Category[] = ['cafe', 'retail', 'events', 'tutoring', 'delivery', 'ngo'];

export default function PostGig() {
  const { addGig } = useBusinessGigs();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [pay, setPay] = useState('');
  const [payRate, setPayRate] = useState<'day' | 'hour'>('day');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState('');

  const handlePost = () => {
    if (!title.trim() || !category || !description.trim() || !pay || !schedule.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    addGig({
      id: `bg-${Date.now()}`,
      title: title.trim(),
      category,
      status: 'open',
      pay: Number(pay),
      payRate,
      schedule: schedule.trim(),
      applicantCount: 0,
      postedDaysAgo: 0,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post a gig</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>GIG TITLE</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={(t) => { setTitle(t); setError(''); }}
              placeholder="e.g. Weekend barista helper"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { setCategory(cat); setError(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{CATEGORY_LABEL[cat]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={(t) => { setDescription(t); setError(''); }}
              placeholder="What will they do? Any requirements?"
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>PAY (RS)</Text>
              <TextInput
                style={styles.input}
                value={pay}
                onChangeText={(t) => { setPay(t.replace(/[^0-9]/g, '')); setError(''); }}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>RATE</Text>
              <View style={styles.rateToggle}>
                {(['day', 'hour'] as const).map((rate) => {
                  const active = payRate === rate;
                  return (
                    <TouchableOpacity
                      key={rate}
                      style={[styles.rateOption, active && styles.rateOptionActive]}
                      onPress={() => setPayRate(rate)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.rateOptionText, active && styles.rateOptionTextActive]}>
                        Per {rate}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SCHEDULE</Text>
            <TextInput
              style={styles.input}
              value={schedule}
              onChangeText={(t) => { setSchedule(t); setError(''); }}
              placeholder="e.g. Sat 9am–2pm"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="warning" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.postButton} onPress={handlePost} activeOpacity={0.9}>
          <Text style={styles.postButtonText}>Post gig</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.draftText}>Save as draft</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.primary,
  },
  cancelText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },

  scrollContent: { padding: spacing.md, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },

  inputGroup: { gap: spacing.xs },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  input: {
    height: 48,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { height: 100, paddingTop: spacing.sm },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.chipActiveBg, borderColor: colors.chipActiveBg },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.chipActiveText },

  rateToggle: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    padding: 3,
    height: 48,
  },
  rateOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  rateOptionActive: { backgroundColor: colors.primary },
  rateOptionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rateOptionTextActive: { color: colors.primaryOnColor },

  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: borderRadius.sm,
    padding: 13,
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.errorText,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13, 21, 21, 0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  postButton: {
    width: '100%',
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.primaryOnColor,
  },
  draftText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
