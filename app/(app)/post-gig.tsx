import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Text, TextInput } from '../../components/LocalizedText';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { borderRadius, colors, spacing, typography } from '../../constants/theme';
import { GIG_CATEGORIES, GigInput, GigValidationErrors, LocationType } from '../../types/gig';
import { Chip, EmptyState, ErrorState, FormField, GigLocationField, LoadingState } from '../../components';
import DatePickerSheet, { toIsoDate } from '../../components/business/DatePickerSheet';
import { authEntrance } from '../../components/auth/AuthUI';
import { formatCalendarDate, formatCurrency } from '../../localization/format';
import { createGig, getGigById, updateGig, validateGigForm } from '../../services/gigService';

const dateInDays = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
};

const SUGGESTED_SKILLS = ['Customer Service', 'Cashier', 'Cleaning', 'Delivery', 'Moving & Lifting', 'Cooking', 'Photography', 'Graphic Design', 'Tutoring', 'Data Entry'];
const BUDGET_PRESETS = ['1000', '2500', '5000', '10000', '25000'];
const MAX_SKILLS = 8;

const LOCATION_TYPES: { type: LocationType; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'on-site', label: 'On-site', description: 'In person', icon: 'storefront-outline' },
  { type: 'hybrid', label: 'Hybrid', description: 'Partly remote', icon: 'swap-horizontal-outline' },
  { type: 'remote', label: 'Remote', description: 'From anywhere', icon: 'globe-outline' },
];

type FieldKey = keyof GigInput;
const STEPS: { title: string; subtitle: string; fields: FieldKey[] }[] = [
  { title: 'The basics', subtitle: 'Give your gig a clear title and pick a category.', fields: ['title', 'category'] },
  { title: 'Describe the work', subtitle: 'Explain what needs doing and any skills that help.', fields: ['description', 'skills'] },
  { title: 'Set the pay', subtitle: 'Fair, clear pay attracts better applicants.', fields: ['pay', 'payType'] },
  { title: 'When & where', subtitle: 'Tell people when and where the work happens.', fields: ['date', 'time', 'locationType', 'location', 'coordinates'] },
  { title: 'Review & post', subtitle: 'Check everything before it goes live.', fields: [] },
];
const LAST_STEP = STEPS.length - 1;

const EMPTY_FORM: GigInput = {
  title: '', description: '', category: '', pay: '', payType: 'fixed',
  date: dateInDays(1), location: '', locationType: 'on-site', skills: [],
};

const haptic = (kind: 'light' | 'success' | 'error' = 'light') => {
  if (Platform.OS === 'web') return;
  const run = kind === 'light' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  void run.catch(() => {});
};

function FieldLabel({ label, required, aside }: { label: string; required?: boolean; aside?: string }) {
  const { t } = useTranslation();
  return <View style={styles.labelRow}>
    <Text style={styles.label}>{t(label)}{required && <Text style={styles.required}> *</Text>}</Text>
    {!!aside && <Text style={styles.aside}>{aside}</Text>}
  </View>;
}

function FieldError({ message }: { message?: string }) {
  const { t } = useTranslation();
  if (!message) return null;
  return <View style={styles.errorRow} accessibilityLiveRegion="polite">
    <Ionicons name="alert-circle" size={14} color={colors.error} />
    <Text style={styles.errorText}>{t(message)}</Text>
  </View>;
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return <View style={styles.reviewCard}>
    <View style={styles.reviewHeader}>
      <Text style={styles.reviewTitle}>{t(title)}</Text>
      <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Edit {{section}}', { section: t(title) })}>
        <Text style={styles.reviewEdit}>{t('Edit')}</Text>
      </Pressable>
    </View>
    {children}
  </View>;
}

export default function PostGigScreen() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const role = userData?.role;
  const { editGigId, id, gigId } = useLocalSearchParams<{ editGigId?: string; id?: string; gigId?: string }>();
  const targetGigId = editGigId || id || gigId;
  const isEditMode = Boolean(targetGigId);
  const scrollRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<GigInput>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [skillInput, setSkillInput] = useState('');
  const [errors, setErrors] = useState<GigValidationErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [loadProblem, setLoadProblem] = useState<{ title: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<{ id: string; syncPending: boolean } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const pendingGigId = useRef<string | null>(null);

  useEffect(() => {
    if (!targetGigId) return;
    let mounted = true;
    void (async () => {
      try {
        const gig = await getGigById(targetGigId);
        if (!mounted) return;
        if (!gig) {
          setLoadProblem({ title: 'Gig Not Found', message: 'The gig you are trying to edit does not exist or has been removed.' });
        } else if (user && gig.postedBy?.uid && gig.postedBy.uid !== user.uid) {
          setLoadProblem({ title: 'Access Denied', message: 'Only the business owner who posted this gig can update it.' });
        } else {
          setForm({
            title: gig.title || '', description: gig.description || '', category: gig.category || '',
            pay: gig.pay !== undefined ? String(gig.pay) : '', payType: gig.payType || 'fixed',
            date: gig.date || dateInDays(1), time: gig.time || '', location: gig.location || '',
            locationType: gig.locationType || 'on-site', coordinates: gig.coordinates,
            skills: Array.isArray(gig.skills) ? [...gig.skills] : [],
          });
          // Editing starts on the summary so owners can jump straight to the part they want to change.
          setStep(LAST_STEP);
        }
      } catch (err: any) {
        if (mounted) setLoadProblem({ title: 'Failed to Load', message: err?.message || 'Could not load gig details for editing.' });
      } finally {
        if (mounted) setInitialLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [targetGigId, user]);

  const update = <K extends FieldKey>(field: K, value: GigInput[K]) => {
    setForm(previous => {
      const next = { ...previous, [field]: value };
      if (touched[field]) setErrors(current => ({ ...current, [field]: validateGigForm(next, isEditMode).errors[field as string] }));
      return next;
    });
  };
  const blur = (field: FieldKey) => {
    setTouched(previous => ({ ...previous, [field]: true }));
    setErrors(current => ({ ...current, [field]: validateGigForm(form, isEditMode).errors[field as string] }));
  };
  const errorFor = (field: FieldKey) => (touched[field] ? errors[field as string] : undefined);

  const goTo = (next: number) => {
    setStep(next);
    setSubmitError('');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  /** Validates only the fields on the given step; returns true when they are all fine. */
  const validateStep = (index: number) => {
    const { errors: all } = validateGigForm(form, isEditMode);
    const fields = STEPS[index].fields;
    setTouched(previous => ({ ...previous, ...Object.fromEntries(fields.map(field => [field, true])) }));
    setErrors(previous => ({ ...previous, ...Object.fromEntries(fields.map(field => [field, all[field as string]])) }));
    return fields.every(field => !all[field as string]);
  };

  const next = () => {
    if (!validateStep(step)) { haptic('error'); return; }
    haptic();
    goTo(step + 1);
  };

  const back = () => {
    if (saving) return;
    if (step > 0 && !(isEditMode && step === LAST_STEP)) goTo(step - 1);
    else router.back();
  };

  const addSkill = (raw?: string) => {
    const text = (raw ?? skillInput).trim();
    if (!text) return;
    if (form.skills.some(skill => skill.toLowerCase() === text.toLowerCase())) { setSkillInput(''); return; }
    if (form.skills.length >= MAX_SKILLS) { setErrors(previous => ({ ...previous, skills: 'Maximum 8 skills allowed.' })); setTouched(p => ({ ...p, skills: true })); return; }
    haptic();
    setForm(previous => ({ ...previous, skills: [...previous.skills, text] }));
    setSkillInput('');
    setErrors(previous => ({ ...previous, skills: undefined }));
  };
  const removeSkill = (skill: string) => {
    setForm(previous => ({ ...previous, skills: previous.skills.filter(item => item !== skill) }));
    setErrors(previous => ({ ...previous, skills: undefined }));
  };

  const submit = async () => {
    if (saving) return;
    // Re-check every step and send the owner to the first one with a problem.
    for (let index = 0; index < LAST_STEP; index += 1) {
      if (!validateStep(index)) { haptic('error'); goTo(index); return; }
    }
    if (!user) { setSubmitError('You must be signed in to perform this action. Please log in first.'); return; }
    setSubmitError('');
    setSaving(true);
    try {
      if (isEditMode && targetGigId) {
        const saved = await updateGig(targetGigId, form);
        setResult({ id: targetGigId, syncPending: saved.syncStatus === 'pending' });
      } else {
        pendingGigId.current ??= `gig_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const saved = await createGig(form, {
          uid: user.uid,
          fullName: userData?.fullName || user.displayName || 'Business Owner',
          email: userData?.email || user.email || '',
        }, pendingGigId.current);
        pendingGigId.current = null;
        setResult({ id: saved.id, syncPending: saved.syncStatus === 'pending' });
      }
      haptic('success');
    } catch (err: any) {
      haptic('error');
      setSubmitError(err?.message || (isEditMode ? 'Could not save your changes. Check your connection and try again.' : 'Could not post your gig. Check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    setForm({ ...EMPTY_FORM, date: dateInDays(1) });
    setTouched({});
    setErrors({});
    setSkillInput('');
    setResult(null);
    goTo(0);
  };

  if (userData && role !== 'client') {
    return <SafeAreaView style={[styles.container, styles.centered]}>
      <EmptyState icon="lock-closed-outline" title="Access Restricted"
        description={tr('Only business owners can post or update gigs. Switch to a business account to manage listings.')}
        actionLabel="Go back" onAction={() => router.back()} secondary />
    </SafeAreaView>;
  }
  if (initialLoading) {
    return <SafeAreaView style={[styles.container, styles.centered]}><LoadingState message={tr('Loading gig details for editing...')} /></SafeAreaView>;
  }
  if (loadProblem) {
    return <SafeAreaView style={[styles.container, styles.centered]}>
      <ErrorState title={loadProblem.title} message={loadProblem.message} retryLabel="Go back" onRetry={() => router.back()} />
    </SafeAreaView>;
  }

  const categoryName = (name: string) => t(GIG_CATEGORIES.find(cat => cat.name === name)?.name ?? name);
  const locationType = LOCATION_TYPES.find(item => item.type === form.locationType);
  const datePresets = [{ label: 'Today', value: dateInDays(0) }, { label: 'Tomorrow', value: dateInDays(1) }, { label: 'In 1 week', value: dateInDays(7) }];
  const customDate = !datePresets.some(preset => preset.value === form.date);

  const stepContent = [
    // 1. Basics
    <>
      <FormField label="Gig title" required value={form.title} maxLength={100} charCount={`${form.title.length}/100`}
        placeholder="e.g. Weekend cashier, Help moving furniture" editable={!saving} containerStyle={styles.noMargin}
        error={errorFor('title')} onChangeText={value => update('title', value)} onBlur={() => blur('title')} />
      <View style={styles.field}>
        <FieldLabel label="Category" required />
        <View style={styles.wrap}>
          {GIG_CATEGORIES.map(cat => <Chip key={cat.id} label={t(cat.name)} icon={cat.icon as any}
            variant={form.category === cat.name ? 'selected' : 'default'}
            onPress={() => { haptic(); setTouched(p => ({ ...p, category: true })); update('category', cat.name); }} />)}
        </View>
        <FieldError message={errorFor('category')} />
      </View>
    </>,
    // 2. Details
    <>
      <FormField label="Description" required multiline value={form.description} maxLength={2500}
        charCount={`${form.description.length}/2500`} editable={!saving} containerStyle={styles.noMargin}
        placeholder="What needs doing, when, and what you expect" numberOfLines={6} textAlignVertical="top"
        hint="At least 20 characters. Mention tasks, tools and anything people should bring."
        error={errorFor('description')} onChangeText={value => update('description', value)} onBlur={() => blur('description')} />
      <View style={styles.field}>
        <FieldLabel label="Helpful skills" aside={`${form.skills.length}/${MAX_SKILLS}`} />
        <View style={styles.skillRow}>
          <TextInput style={styles.skillInput} value={skillInput} onChangeText={setSkillInput} editable={!saving}
            placeholder={t('Add a skill')} placeholderTextColor={colors.placeholder}
            returnKeyType="done" submitBehavior="submit" onSubmitEditing={() => addSkill()} />
          <Pressable onPress={() => addSkill()} disabled={!skillInput.trim()} accessibilityRole="button" accessibilityLabel={t('Add')}
            style={({ pressed }) => [styles.addButton, !skillInput.trim() && styles.disabled, pressed && styles.pressed]}>
            <Ionicons name="add" size={22} color={colors.primaryOnColor} />
          </Pressable>
        </View>
        {form.skills.length > 0 && <View style={styles.wrap}>
          {form.skills.map(skill => <Chip key={skill} label={skill} variant="selected" onRemove={() => removeSkill(skill)} />)}
        </View>}
        <FieldError message={errorFor('skills')} />
        <Text style={styles.subtle}>{t('Suggestions')}</Text>
        <View style={styles.wrap}>
          {SUGGESTED_SKILLS.filter(skill => !form.skills.includes(skill)).slice(0, 6).map(skill =>
            <Chip key={skill} label={`+ ${t(skill)}`} variant="outline" onPress={() => addSkill(skill)} />)}
        </View>
      </View>
    </>,
    // 3. Pay
    <>
      <View style={styles.segment}>
        {(['fixed', 'hourly'] as const).map(type => {
          const active = form.payType === type;
          return <Pressable key={type} onPress={() => { haptic(); update('payType', type); }} accessibilityRole="radio" accessibilityState={{ checked: active }}
            style={({ pressed }) => [styles.segmentItem, active && styles.segmentActive, pressed && styles.pressed]}>
            <Ionicons name={type === 'fixed' ? 'wallet-outline' : 'time-outline'} size={18} color={active ? colors.primary : colors.textSecondary} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{type === 'fixed' ? t('Fixed price') : t('Hourly rate')}</Text>
          </Pressable>;
        })}
      </View>
      <View style={styles.field}>
        <FieldLabel label={form.payType === 'fixed' ? 'Total budget (LKR)' : 'Hourly rate (LKR / hr)'} required />
        <View style={[styles.payInput, errorFor('pay') && styles.inputError]}>
          <Text style={styles.payPrefix}>{t('LKR')}</Text>
          <TextInput style={styles.payField} value={form.pay} placeholder="0" placeholderTextColor={colors.placeholder}
            keyboardType="decimal-pad" editable={!saving} accessibilityLabel={t('Pay')}
            onChangeText={value => update('pay', value.replace(/[^0-9.]/g, ''))} onBlur={() => blur('pay')} />
          {form.payType === 'hourly' && <Text style={styles.paySuffix}>{t('/hr')}</Text>}
        </View>
        <FieldError message={errorFor('pay')} />
        <View style={styles.wrap}>
          {BUDGET_PRESETS.map(preset => <Chip key={preset} label={formatCurrency(Number(preset))}
            variant={form.pay === preset ? 'selected' : 'default'}
            onPress={() => { haptic(); setTouched(p => ({ ...p, pay: true })); update('pay', preset); }} />)}
        </View>
      </View>
    </>,
    // 4. When & where
    <>
      <View style={styles.field}>
        <FieldLabel label="Date" required />
        <View style={styles.wrap}>
          {datePresets.map(preset => <Chip key={preset.label} label={t(preset.label)} variant={form.date === preset.value ? 'selected' : 'default'}
            onPress={() => { haptic(); setTouched(p => ({ ...p, date: true })); update('date', preset.value); }} />)}
          <Chip label={customDate && form.date ? formatCalendarDate(form.date) : t('Pick a date')} icon="calendar-outline"
            variant={customDate && form.date ? 'selected' : 'default'} onPress={() => setShowDatePicker(true)} />
        </View>
        <FieldError message={errorFor('date')} />
      </View>
      <FormField label="Start time (optional)" value={form.time ?? ''} placeholder="HH:MM, e.g. 09:30" icon="time-outline"
        keyboardType="numbers-and-punctuation" maxLength={5} editable={!saving} containerStyle={styles.noMargin}
        hint="24-hour time at the gig location." error={errorFor('time')}
        onChangeText={value => update('time', value)} onBlur={() => blur('time')} />
      <View style={styles.field}>
        <FieldLabel label="Work arrangement" />
        <View style={styles.typeRow}>
          {LOCATION_TYPES.map(item => {
            const active = form.locationType === item.type;
            return <Pressable key={item.type} accessibilityRole="radio" accessibilityState={{ checked: active }}
              onPress={() => { haptic(); update('locationType', item.type); if (item.type === 'remote' && !form.location) update('location', 'Remote'); }}
              style={({ pressed }) => [styles.typeCard, active && styles.typeCardActive, pressed && styles.pressed]}>
              <Ionicons name={item.icon} size={22} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t(item.label)}</Text>
              <Text style={styles.typeDescription}>{t(item.description)}</Text>
            </Pressable>;
          })}
        </View>
      </View>
      <FormField label={form.locationType === 'remote' ? 'Location note (optional)' : 'Address or area'} required={form.locationType !== 'remote'}
        value={form.location} icon={form.locationType === 'remote' ? 'globe-outline' : 'location-outline'} editable={!saving}
        placeholder={form.locationType === 'remote' ? 'e.g. Anywhere in Sri Lanka' : 'e.g. Shop name, street, Colombo 05'}
        containerStyle={styles.noMargin} error={errorFor('location')}
        onChangeText={value => update('location', value)} onBlur={() => blur('location')} />
      {form.locationType !== 'remote' && (
        <GigLocationField address={form.location} value={form.coordinates} error={errorFor('coordinates')} disabled={saving}
          onAddressSelected={place => {
            setForm(previous => ({ ...previous, location: place.label, coordinates: place.coordinates }));
            setErrors(previous => ({ ...previous, location: undefined, coordinates: undefined }));
          }}
          onChange={coordinates => { update('coordinates', coordinates); setErrors(previous => ({ ...previous, coordinates: undefined })); }} />
      )}
    </>,
    // 5. Review
    <>
      <ReviewSection title="The basics" onEdit={() => goTo(0)}>
        <Text style={styles.reviewMain}>{form.title}</Text>
        {!!form.category && <Text style={styles.reviewMeta}>{categoryName(form.category)}</Text>}
      </ReviewSection>
      <ReviewSection title="Describe the work" onEdit={() => goTo(1)}>
        <Text style={styles.reviewBody} numberOfLines={5}>{form.description}</Text>
        {form.skills.length > 0 && <View style={styles.wrap}>{form.skills.map(skill => <Chip key={skill} label={skill} size="sm" />)}</View>}
      </ReviewSection>
      <ReviewSection title="Set the pay" onEdit={() => goTo(2)}>
        <Text style={styles.reviewMain}>
          {formatCurrency(Number(form.pay) || 0)}<Text style={styles.reviewMeta}>{form.payType === 'hourly' ? t('/hr') : t(' fixed')}</Text>
        </Text>
      </ReviewSection>
      <ReviewSection title="When & where" onEdit={() => goTo(3)}>
        <View style={styles.reviewLine}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.reviewBody}>{form.date ? formatCalendarDate(form.date) : t('Flexible')}{form.time ? ` · ${form.time}` : ''}</Text>
        </View>
        <View style={styles.reviewLine}>
          <Ionicons name={locationType?.icon ?? 'location-outline'} size={16} color={colors.textSecondary} />
          <Text style={styles.reviewBody}>{t(locationType?.label ?? '')}{form.location ? ` · ${form.location}` : ''}</Text>
        </View>
      </ReviewSection>
      {!!submitError && <View style={styles.submitError} accessibilityRole="alert">
        <Ionicons name="alert-circle" size={20} color={colors.error} />
        <Text style={styles.submitErrorText}>{t(submitError)}</Text>
      </View>}
    </>,
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={back} disabled={saving} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Go back')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Ionicons name={step === 0 || (isEditMode && step === LAST_STEP) ? 'close' : 'arrow-back'} size={22} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>{isEditMode ? t('Edit gig') : t('Post a gig')}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.progressWrap} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}>
        <Text style={styles.progressText}>{t('Step {{current}} of {{total}}', { current: step + 1, total: STEPS.length })}</Text>
        <View style={styles.progressBars}>
          {STEPS.map((_, index) => <View key={index} style={[styles.progressBar, index <= step && styles.progressBarDone]} />)}
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View key={step} entering={authEntrance(0)} style={styles.stepBody}>
            <View style={styles.intro}>
              <Text style={styles.stepTitle}>{t(STEPS[step].title)}</Text>
              <Text style={styles.stepSubtitle}>{t(STEPS[step].subtitle)}</Text>
            </View>
            {stepContent[step]}
          </Animated.View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {step > 0 && !(isEditMode && step === LAST_STEP) && (
            <Pressable onPress={back} disabled={saving} accessibilityRole="button"
              style={({ pressed }) => [styles.footerButton, styles.footerSecondary, pressed && styles.pressed]}>
              <Text style={styles.footerSecondaryText}>{t('Back')}</Text>
            </Pressable>
          )}
          <Pressable onPress={step === LAST_STEP ? submit : next} disabled={saving} accessibilityRole="button" accessibilityState={{ busy: saving }}
            style={({ pressed }) => [styles.footerButton, styles.footerPrimary, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator color={colors.primaryOnColor} /> : <>
              <Text style={styles.footerPrimaryText}>
                {step < LAST_STEP ? t('Continue') : isEditMode ? t('Save changes') : t('Post gig')}
              </Text>
              <Ionicons name={step < LAST_STEP ? 'arrow-forward' : isEditMode ? 'checkmark' : 'paper-plane-outline'} size={18} color={colors.primaryOnColor} />
            </>}
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <DatePickerSheet visible={showDatePicker} value={form.date}
        minDate={isEditMode ? new Date(2000, 0, 1) : undefined}
        onSelect={date => { setShowDatePicker(false); setTouched(p => ({ ...p, date: true })); update('date', date); }}
        onClose={() => setShowDatePicker(false)} />

      <Modal visible={!!result} transparent animationType="fade" statusBarTranslucent onRequestClose={() => router.back()}>
        <View style={styles.overlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}><Ionicons name="checkmark" size={36} color={colors.primary} /></View>
            <Text accessibilityRole="header" style={styles.successTitle}>
              {isEditMode ? t('Changes saved') : result?.syncPending ? t('Gig queued for publishing') : t('Your gig is live!')}
            </Text>
            <Text style={styles.successBody}>
              {isEditMode ? t('"{{title}}" has been updated.', { title: form.title })
                : result?.syncPending ? t('"{{title}}" will be published as soon as you are back online.', { title: form.title })
                : t('"{{title}}" is now open for applications. We will let you know when people apply.', { title: form.title })}
            </Text>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.footerButton, styles.footerPrimary, styles.successButton, pressed && styles.pressed]}
              onPress={() => { const gig = result?.id; setResult(null); router.replace({ pathname: '/(app)/gig/[id]', params: { id: gig } } as any); }}>
              <Text style={styles.footerPrimaryText}>{t('View gig')}</Text>
            </Pressable>
            {isEditMode
              ? <Pressable accessibilityRole="button" style={({ pressed }) => [styles.footerButton, styles.footerSecondary, styles.successButton, pressed && styles.pressed]}
                onPress={() => { setResult(null); router.replace('/(app)/(tabs)/my-gigs' as any); }}>
                <Text style={styles.footerSecondaryText}>{t('Back to My Gigs')}</Text>
              </Pressable>
              : <Pressable accessibilityRole="button" style={({ pressed }) => [styles.footerButton, styles.footerSecondary, styles.successButton, pressed && styles.pressed]}
                onPress={startOver}>
                <Text style={styles.footerSecondaryText}>{t('Post another gig')}</Text>
              </Pressable>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', padding: spacing.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  noMargin: { marginBottom: 0 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerButton: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.text },
  progressWrap: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  progressText: { ...typography.caption, color: colors.textSecondary },
  progressBars: { flexDirection: 'row', gap: spacing.xs + 2 },
  progressBar: { flex: 1, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.surfaceBorder },
  progressBarDone: { backgroundColor: colors.primary },

  content: { padding: spacing.md, paddingBottom: spacing.xl },
  stepBody: { gap: spacing.lg },
  intro: { gap: spacing.xs },
  stepTitle: { ...typography.display, color: colors.text },
  stepSubtitle: { ...typography.body, color: colors.textSecondary },

  field: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.label, fontSize: 14, color: colors.text },
  required: { color: colors.error },
  aside: { ...typography.caption, color: colors.textSecondary },
  subtle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  errorText: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: colors.error, flexShrink: 1 },
  inputError: { borderColor: colors.error },

  skillRow: { flexDirection: 'row', gap: spacing.sm },
  skillInput: { ...typography.body, flex: 1, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface, color: colors.text },
  addButton: { width: 48, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },

  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  segmentText: { ...typography.label, fontSize: 14, color: colors.textSecondary },
  segmentTextActive: { color: colors.primaryDark },
  payInput: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: spacing.md, gap: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface },
  payPrefix: { ...typography.title, color: colors.textSecondary },
  payField: { ...typography.h2, flex: 1, color: colors.text, paddingVertical: spacing.sm },
  paySuffix: { ...typography.body, color: colors.textSecondary },

  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeCard: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeLabel: { ...typography.label, color: colors.text, marginTop: spacing.xs },
  typeLabelActive: { color: colors.primaryDark },
  typeDescription: { ...typography.caption, fontFamily: typography.bodySmall.fontFamily, color: colors.textSecondary, textAlign: 'center' },

  reviewCard: { padding: spacing.md, gap: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewTitle: { ...typography.label, color: colors.textSecondary },
  reviewEdit: { ...typography.label, color: colors.primary },
  reviewMain: { ...typography.h3, color: colors.text },
  reviewMeta: { ...typography.bodySmall, color: colors.textSecondary },
  reviewBody: { ...typography.body, color: colors.text, flexShrink: 1 },
  reviewLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  submitError: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.errorLight },
  submitErrorText: { ...typography.bodySmall, flex: 1, color: colors.error },

  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm + spacing.xs, paddingBottom: spacing.sm + spacing.xs, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  footerButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  footerPrimary: { flex: 1, backgroundColor: colors.primary },
  footerPrimaryText: { ...typography.title, color: colors.primaryOnColor },
  footerSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  footerSecondaryText: { ...typography.title, color: colors.text },

  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  successCard: { width: '100%', maxWidth: 400, alignSelf: 'center', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.lg, borderRadius: borderRadius.lg, backgroundColor: colors.surface },
  successIcon: { width: 72, height: 72, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  successTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  successBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  successButton: { alignSelf: 'stretch', flex: 0 },
});
