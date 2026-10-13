import { useTranslation } from 'react-i18next';
import { translate as tr } from '../../localization/i18n';
import AppBanner from '../../components/AppBanner';
import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Modal, Animated, Alert } from 'react-native';
import { Text, TextInput } from '../../components/LocalizedText';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, fonts } from '../../constants/theme';
import { GIG_CATEGORIES, GigInput, GigValidationErrors, LocationType } from '../../types/gig';
import { FormField, GigLocationField } from '../../components';
import { createGig, updateGig, getGigById, validateGigForm } from '../../services/gigService';

// Quick date helper presets
const getFormattedDate = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const SUGGESTED_SKILLS = [
  'React Native',
  'UI/UX Design',
  'Graphic Design',
  'Copywriting',
  'SEO',
  'Plumbing',
  'Electrical',
  'Moving & Lifting',
  'Delivery',
  'Photography',
];

const BUDGET_PRESETS = ['50', '100', '250', '500', '1000'];

type SubmissionStage = 'idle' | 'validating' | 'saving' | 'done';

export default function PostGigScreen() {
  useTranslation();
  const { user, userData } = useAuth();
  const role = userData?.role;
  const { editGigId, id, gigId } = useLocalSearchParams<{ editGigId?: string; id?: string; gigId?: string }>();
  const targetGigId = editGigId || id || gigId;
  const isEditMode = Boolean(targetGigId);

  const [initialLoading, setInitialLoading] = useState(isEditMode);

  // Form State
  const [form, setForm] = useState<GigInput>({
    title: '',
    description: '',
    category: '',
    pay: '',
    payType: 'fixed',
    date: getFormattedDate(1), // Default to tomorrow
    location: '',
    locationType: 'remote',
    skills: [],
  });

  const [skillInput, setSkillInput] = useState('');
  const [errors, setErrors] = useState<GigValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submissionStage, setSubmissionStage] = useState<SubmissionStage>('idle');
  const [submitError, setSubmitError] = useState('');
  const [createdGigId, setCreatedGigId] = useState('');
  const [syncPending, setSyncPending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const pendingGigId = useRef<string | null>(null);

  // Selected date components for picker modal
  const [pickerDate, setPickerDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  });

  // Load existing gig details if in edit mode
  useEffect(() => {
    if (!targetGigId) return;

    let isMounted = true;

    async function loadGigForEditing() {
      if (!isMounted) return;
      setInitialLoading(true);
      try {
        const gig = await getGigById(targetGigId!);
        if (!isMounted) return;

        if (!gig) {
          Alert.alert(tr("Gig Not Found"), tr("The gig you are trying to edit does not exist or has been removed."), [
            { text: tr("Go Back"), onPress: () => router.back() },
          ]);
          return;
        }

        if (user && gig.postedBy?.uid && gig.postedBy.uid !== user.uid) {
          Alert.alert(tr("Access Denied"), tr("Only the business owner who posted this gig can update it."), [
            { text: tr("Go Back"), onPress: () => router.back() },
          ]);
          return;
        }

        setForm({
          title: gig.title || '',
          description: gig.description || '',
          category: gig.category || '',
          pay: gig.pay !== undefined ? String(gig.pay) : '',
          payType: gig.payType || 'fixed',
          date: gig.date || getFormattedDate(1),
          time: gig.time || '',
          location: gig.location || '',
          locationType: gig.locationType || 'remote',
          coordinates: gig.coordinates,
          skills: Array.isArray(gig.skills) ? [...gig.skills] : [],
        });

        if (gig.date) {
          const parts = gig.date.split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
              setPickerDate({ year: y, month: m, day: d });
            }
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        Alert.alert(tr("Failed to Load"), err.message || tr("Could not load gig details for editing."), [
          { text: tr("Go Back"), onPress: () => router.back() },
        ]);
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    }

    void Promise.resolve().then(loadGigForEditing);

    return () => {
      isMounted = false;
    };
  }, [targetGigId, user]);

  // Animation values
  const [buttonScale] = useState(() => new Animated.Value(1));

  const handlePressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const handlePressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  // Field change handler with live validation update
  const handleChange = (field: keyof GigInput, value: any) => {
    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);

    if (touched[field]) {
      const { errors: newErrors } = validateGigForm(updatedForm, isEditMode);
      setErrors((prev) => ({
        ...prev,
        [field]: newErrors[field],
      }));
    }
  };

  const handleBlur = (field: keyof GigInput) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const { errors: newErrors } = validateGigForm(form, isEditMode);
    setErrors((prev) => ({
      ...prev,
      [field]: newErrors[field],
    }));
  };

  // Skill management
  const handleAddSkill = (skillToAdd?: string) => {
    const text = (skillToAdd || skillInput).trim();
    if (!text) return;
    if (form.skills.includes(text)) {
      setSkillInput('');
      return;
    }
    if (form.skills.length >= 8) {
      setErrors((prev) => ({ ...prev, skills: 'Maximum 8 skills allowed.' }));
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setForm((prev) => ({ ...prev, skills: [...prev.skills, text] }));
    setSkillInput('');
    setErrors((prev) => ({ ...prev, skills: undefined }));
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  // Date selection presets
  const handleSelectDatePreset = (daysOffset: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const formatted = getFormattedDate(daysOffset);
    handleChange('date', formatted);
    setTouched((prev) => ({ ...prev, date: true }));
  };

  // Custom date picker apply
  const handleApplyDatePicker = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const yyyy = pickerDate.year;
    const mm = String(pickerDate.month).padStart(2, '0');
    const dd = String(pickerDate.day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    handleChange('date', dateStr);
    setTouched((prev) => ({ ...prev, date: true }));
    setShowDatePickerModal(false);
  };

  // Form Submission & Database Persistence
  const handleSubmit = async () => {
    // Mark all required fields as touched
    setTouched({
      title: true,
      description: true,
      category: true,
      pay: true,
      date: true,
      location: true,
    });

    setSubmissionStage('validating');
    const { isValid, errors: validationErrors } = validateGigForm(form, isEditMode);
    setErrors(validationErrors);

    if (!isValid) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      setSubmissionStage('idle');
      setSubmitError('Please correct the highlighted fields before submitting.');
      return;
    }

    if (!user) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      setSubmissionStage('idle');
      setSubmitError('You must be signed in to perform this action. Please log in first.');
      return;
    }

    setSubmitError('');
    setLoading(true);
    setSubmissionStage('saving');

    try {
      if (isEditMode && targetGigId) {
        const result = await updateGig(targetGigId, form);
        setCreatedGigId(targetGigId);
        setSyncPending(result.syncStatus === 'pending');
      } else {
        if (!pendingGigId.current) {
          pendingGigId.current = `gig_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        }
        const result = await createGig(form, {
          uid: user.uid,
          fullName: userData?.fullName || user.displayName || 'Business Owner',
          email: userData?.email || user.email || '',
        }, pendingGigId.current);

        setCreatedGigId(result.id);
        setSyncPending(result.syncStatus === 'pending');
        pendingGigId.current = null;
      }

      setSubmissionStage('done');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error(isEditMode ? 'Error updating gig:' : 'Error posting gig:', err);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      setSubmissionStage('idle');
      setSubmitError(
        err?.message || (isEditMode ? 'Failed to update gig in database. Please check your connection and retry.' : 'Failed to persist gig in database. Please check your connection and retry.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setForm({
      title: '',
      description: '',
      category: '',
      pay: '',
      payType: 'fixed',
      date: getFormattedDate(1),
      location: '',
      locationType: 'remote',
      skills: [],
    });
    setTouched({});
    setErrors({});
    setSubmitError('');
    setCreatedGigId('');
    setSyncPending(false);
    setSubmissionStage('idle');
    pendingGigId.current = null;
    setShowSuccessModal(false);
  };

  useEffect(() => {
    if (userData && role !== 'client') {
      Alert.alert(
        tr("Access Restricted"),
        tr("Only business owners can post or update gigs. Switch to a business account to manage listings."),
        [{ text: tr("OK"), onPress: () => router.back() }],
      );
    }
  }, [userData, role]);

  if (userData && role !== 'client') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{tr("Redirecting...")}</Text>
      </SafeAreaView>
    );
  }

  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: spacing.md, color: colors.textSecondary, fontSize: 14, fontFamily: fonts.bodyMedium }}>{tr("Loading gig details for editing...")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background glowing decorations */}



      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>{isEditMode ? tr("Update Gig") : tr("Post a New Gig")}</Text>
          <Text style={styles.navSubtitle}>
            {isEditMode ? tr("Modify your gig listing details") : tr("Reach active freelancers & local youth")}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isEditMode ? (
            <AppBanner
              compact
              kind="business"
              title={tr("Keep your gig details accurate.")}
              description={tr("Changes will be saved to Firebase and updated across the platform.")}
            />
          ) : (
            <AppBanner
              compact
              kind="business"
              title={tr("Make room for local talent.")}
              description={tr("Clear details help the right people find your gig.")}
            />
          )}
          {/* Submission Error Banner with Retry Option */}
          {submitError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorBannerTitle}>
                  {isEditMode ? tr("Unable to Update Gig") : tr("Unable to Post Gig")}
                </Text>
                <Text style={styles.errorBannerText}>{submitError}</Text>
              </View>
              <TouchableOpacity
                style={styles.retryBannerBtn}
                onPress={handleSubmit}
                activeOpacity={0.7}
              >
                <Text style={styles.retryBannerBtnText}>{tr("Retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ============================================================ */}
          {/* SECTION 1: GIG OVERVIEW */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr("1. Gig Overview")}</Text>
            </View>

            {/* Gig Title */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{tr("Gig Title")}<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <Text style={styles.charCount}>{form.title.length}/100</Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  touched.title && errors.title ? styles.inputError : null,
                ]}
                placeholder={tr("e.g. Build Landing Page, Repair Kitchen Pipe, Yard Care...")}
                placeholderTextColor={colors.textMuted}
                value={form.title}
                onChangeText={(val) => handleChange('title', val)}
                onBlur={() => handleBlur('title')}
                editable={!loading}
                maxLength={100}
              />
              {touched.title && errors.title && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldErrorText}>{errors.title}</Text>
                </View>
              )}
            </View>

            {/* Category Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{tr("Category")}<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.categoriesGrid}>
                {GIG_CATEGORIES.map((cat) => {
                  const isSelected = form.category === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipActive,
                      ]}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        handleChange('category', cat.name);
                        setTouched((prev) => ({ ...prev, category: true }));
                      }}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={15}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextActive,
                        ]}
                      >
                        {tr(cat.name)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {touched.category && errors.category && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldErrorText}>{errors.category}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ============================================================ */}
          {/* SECTION 2: DESCRIPTION & REQUIREMENTS */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr("2. Details & Requirements")}</Text>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{tr("Detailed Description")}<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <Text style={styles.charCount}>{form.description.length}/2500</Text>
              </View>
              <TextInput
                style={[
                  styles.textArea,
                  touched.description && errors.description ? styles.inputError : null,
                ]}
                placeholder={tr("Explain the job scope, required deliverables, tools needed, and expectations...")}
                placeholderTextColor={colors.textMuted}
                value={form.description}
                onChangeText={(val) => handleChange('description', val)}
                onBlur={() => handleBlur('description')}
                editable={!loading}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={2500}
              />
              {touched.description && errors.description && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldErrorText}>{errors.description}</Text>
                </View>
              )}
            </View>

            {/* Skills & Tags */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{tr("Required Skills or Tags (Optional)")}</Text>
              <View style={styles.skillInputRow}>
                <TextInput
                  style={[styles.input, styles.skillInputField]}
                  placeholder={tr("e.g. React, Fast Worker, Lift 40lbs...")}
                  placeholderTextColor={colors.textMuted}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  editable={!loading}
                  onSubmitEditing={() => handleAddSkill()}
                />
                <TouchableOpacity
                  style={styles.addSkillBtn}
                  onPress={() => handleAddSkill()}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color={colors.primaryOnColor} />
                  <Text style={styles.addSkillBtnText}>{tr("Add")}</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Skill Tags */}
              {form.skills.length > 0 && (
                <View style={styles.skillsChipsContainer}>
                  {form.skills.map((skill) => (
                    <View key={skill} style={styles.selectedSkillChip}>
                      <Text style={styles.selectedSkillText}>{skill}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveSkill(skill)}
                        style={styles.removeSkillBtn}
                        disabled={loading}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Suggested Skills */}
              <View style={styles.suggestedSkillsContainer}>
                <Text style={styles.suggestedTitle}>{tr("Suggested:")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.suggestedRow}>
                    {SUGGESTED_SKILLS.filter((s) => !form.skills.includes(s)).map((skill) => (
                      <TouchableOpacity
                        key={skill}
                        style={styles.suggestedChip}
                        onPress={() => handleAddSkill(skill)}
                        disabled={loading}
                      >
                        <Text style={styles.suggestedChipText}>+ {skill}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </View>

          {/* ============================================================ */}
          {/* SECTION 3: COMPENSATION & PAY */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="cash-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr("3. Compensation")}</Text>
            </View>

            {/* Pay Type Toggle */}
            <View style={styles.payTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.payTypeBtn,
                  form.payType === 'fixed' && styles.payTypeBtnActive,
                ]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  handleChange('payType', 'fixed');
                }}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="wallet-outline"
                  size={16}
                  color={form.payType === 'fixed' ? colors.primaryOnColor : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.payTypeBtnText,
                    form.payType === 'fixed' && styles.payTypeBtnTextActive,
                  ]}
                >{tr("Fixed Price ($)")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.payTypeBtn,
                  form.payType === 'hourly' && styles.payTypeBtnActive,
                ]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  handleChange('payType', 'hourly');
                }}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={form.payType === 'hourly' ? colors.primaryOnColor : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.payTypeBtnText,
                    form.payType === 'hourly' && styles.payTypeBtnTextActive,
                  ]}
                >{tr("Hourly Rate ($/hr)")}</Text>
              </TouchableOpacity>
            </View>

            {/* Pay Amount Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {form.payType === 'fixed' ? tr("Total Gig Budget ($)") : tr("Hourly Rate ($/hr)")}{' '}
                <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View
                style={[
                  styles.currencyInputContainer,
                  touched.pay && errors.pay ? styles.inputError : null,
                ]}
              >
                <Text style={styles.currencyPrefix}>{tr("Rs.")}</Text>
                <TextInput
                  style={styles.currencyInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={form.pay}
                  onChangeText={(val) => handleChange('pay', val)}
                  onBlur={() => handleBlur('pay')}
                  editable={!loading}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currencySuffix}>
                  {form.payType === 'fixed' ? tr("LKR") : tr("LKR / hr")}
                </Text>
              </View>
              {touched.pay && errors.pay && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldErrorText}>{errors.pay}</Text>
                </View>
              )}

              {/* Quick Budget Presets */}
              <View style={styles.budgetPresetsRow}>
                <Text style={styles.budgetPresetsLabel}>{tr("Quick pick:")}</Text>
                {BUDGET_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      form.pay === preset && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      handleChange('pay', preset);
                      setTouched((prev) => ({ ...prev, pay: true }));
                    }}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        form.pay === preset && styles.presetChipTextActive,
                      ]}
                    >
                      ${preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ============================================================ */}
          {/* SECTION 4: DATE & SCHEDULE */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr("4. Date & Deadline")}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{tr("Gig Date / Needed By")}<Text style={styles.requiredAsterisk}>*</Text>
              </Text>

              {/* Quick Date Chips */}
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    form.date === getFormattedDate(0) && styles.dateChipActive,
                  ]}
                  onPress={() => handleSelectDatePreset(0)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      form.date === getFormattedDate(0) && styles.dateChipTextActive,
                    ]}
                  >{tr("⚡ Today")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    form.date === getFormattedDate(1) && styles.dateChipActive,
                  ]}
                  onPress={() => handleSelectDatePreset(1)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      form.date === getFormattedDate(1) && styles.dateChipTextActive,
                    ]}
                  >{tr("Tomorrow")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    form.date === getFormattedDate(7) && styles.dateChipActive,
                  ]}
                  onPress={() => handleSelectDatePreset(7)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      form.date === getFormattedDate(7) && styles.dateChipTextActive,
                    ]}
                  >{tr("In 1 Week")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.customDateBtn}
                  onPress={() => setShowDatePickerModal(true)}
                  disabled={loading}
                >
                  <Ionicons name="calendar" size={14} color={colors.primary} />
                  <Text style={styles.customDateBtnText}>{tr("Custom")}</Text>
                </TouchableOpacity>
              </View>

              {/* Date Display / Input */}
              <TouchableOpacity
                style={[
                  styles.dateDisplayInput,
                  touched.date && errors.date ? styles.inputError : null,
                ]}
                onPress={() => setShowDatePickerModal(true)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-clear-outline" size={18} color={colors.primary} />
                <Text style={styles.dateDisplayText}>
                  {form.date ? tr("Target Date: {{value0}}", { value0: form.date }) : tr("Select a date")}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {touched.date && errors.date && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldErrorText}>{errors.date}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ============================================================ */}
          {/* SECTION 5: LOCATION & WORK ARRANGEMENT */}
          {/* ============================================================ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr("5. Location & Work Setup")}</Text>
            </View>

            {/* Location Type Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{tr("Work Arrangement")}</Text>
              <View style={styles.locationTypeGrid}>
                {[
                  { type: 'remote' as LocationType, label: 'Remote', icon: 'globe-outline', desc: 'Anywhere' },
                  { type: 'on-site' as LocationType, label: 'On-Site', icon: 'navigate-outline', desc: 'In Person' },
                  { type: 'hybrid' as LocationType, label: 'Hybrid', icon: 'business-outline', desc: 'Mixed' },
                ].map((item) => {
                  const isSelected = form.locationType === item.type;
                  return (
                    <TouchableOpacity
                      key={item.type}
                      style={[
                        styles.locationTypeCard,
                        isSelected && styles.locationTypeCardActive,
                      ]}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        handleChange('locationType', item.type);
                        if (item.type === 'remote' && !form.location) {
                          handleChange('location', 'Remote');
                        }
                      }}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.locationTypeLabel,
                          isSelected && styles.locationTypeLabelActive,
                        ]}
                      >
                        {tr(item.label)}
                      </Text>
                      <Text style={styles.locationTypeDesc}>{tr(item.desc)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location Address / City Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {form.locationType === 'remote'
                  ? tr("Location / Timezone Note (Optional)")
                  : tr("City, Address or Area")}{' '}
                {form.locationType !== 'remote' && <Text style={styles.requiredAsterisk}>*</Text>}
              </Text>
              <View
                style={[
                  styles.inputWithIcon,
                  touched.location && errors.location ? styles.inputError : null,
                ]}
              >
                <Ionicons
                  name={form.locationType === 'remote' ? 'globe-outline' : 'location-sharp'}
                  size={18}
                  color={colors.primary}
                  style={styles.inputLeadingIcon}
                />
                <TextInput
                  style={styles.inputInner}
                  placeholder={
                    form.locationType === 'remote'
                      ? tr("e.g. Worldwide, US Timezones, etc.")
                      : tr("e.g. business name, street, Colombo")
                  }
                  placeholderTextColor={colors.textMuted}
                  value={form.location}
                  onChangeText={(val) => setForm(previous => ({ ...previous, location: val }))}
                  onBlur={() => handleBlur('location')}
                  editable={!loading}
                />
              </View>
              {touched.location && errors.location && (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldErrorText}>{errors.location}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <FormField label={tr("Gig start time (optional)")} value={form.time ?? ''} placeholder={tr("HH:MM (24-hour)")} error={errors.time} editable={!loading}
              onChangeText={time => handleChange('time', time)} hint={tr("Use the local time at the gig location.")} />
          </View>
          {form.locationType !== 'remote' && <View style={styles.fieldGroup}>
            <GigLocationField address={form.location} value={form.coordinates} error={errors.coordinates} disabled={loading}
              onAddressSelected={result => {
                setForm(previous => ({ ...previous, location: result.label, coordinates: result.coordinates }));
                setErrors(previous => ({ ...previous, location: undefined, coordinates: undefined }));
              }}
              onChange={coordinates => { handleChange('coordinates', coordinates); setErrors(previous => ({ ...previous, coordinates: undefined })); }} />
          </View>}

          {/* ============================================================ */}
          {/* SUBMIT BUTTON */}
          {/* ============================================================ */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.primaryOnColor} size="small" />
                  <Text style={styles.submitButtonText}>
                    {submissionStage === 'saving'
                      ? (isEditMode ? 'Updating in Firestore...' : 'Persisting to Firestore...')
                      : tr("Validating Gig...")}
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name={isEditMode ? 'save-outline' : 'paper-plane'} size={18} color={colors.primaryOnColor} />
                  <Text style={styles.submitButtonText}>{isEditMode ? tr("Update Gig Now") : tr("Post Gig Now")}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============================================================ */}
      {/* CUSTOM DATE PICKER MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModalContent}>
            <View style={styles.datePickerModalHeader}>
              <Text style={styles.datePickerModalTitle}>{tr("Select Target Date")}</Text>
              <TouchableOpacity
                onPress={() => setShowDatePickerModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Quick Pickers for Year, Month, Day */}
            <View style={styles.pickerColumnsRow}>
              {/* Year */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>{tr("Year")}</Text>
                {[2026, 2027].map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[
                      styles.pickerItem,
                      pickerDate.year === y && styles.pickerItemActive,
                    ]}
                    onPress={() => setPickerDate((p) => ({ ...p, year: y }))}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        pickerDate.year === y && styles.pickerItemTextActive,
                      ]}
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Month */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>{tr("Month")}</Text>
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const monthNames = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December',
                    ];
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.pickerItem,
                          pickerDate.month === m && styles.pickerItemActive,
                        ]}
                        onPress={() => setPickerDate((p) => ({ ...p, month: m }))}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            pickerDate.month === m && styles.pickerItemTextActive,
                          ]}
                        >
                          {tr(monthNames[m - 1])}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Day */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>{tr("Day")}</Text>
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.pickerItem,
                        pickerDate.day === d && styles.pickerItemActive,
                      ]}
                      onPress={() => setPickerDate((p) => ({ ...p, day: d }))}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          pickerDate.day === d && styles.pickerItemTextActive,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Selected Date Summary */}
            <View style={styles.modalDatePreview}>
              <Text style={styles.modalDatePreviewLabel}>{tr("Selected Date:")}</Text>
              <Text style={styles.modalDatePreviewValue}>
                {pickerDate.year}-{String(pickerDate.month).padStart(2, '0')}-{String(pickerDate.day).padStart(2, '0')}
              </Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>{tr("Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyDatePicker}
              >
                <Text style={styles.modalApplyBtnText}>{tr("Apply Date")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* SUCCESS CONFIRMATION MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={54} color={colors.primary} />
            </View>

            <Text style={styles.successTitle}>
              {isEditMode
                ? tr("Gig Updated Successfully! 🎉")
                : syncPending
                ? tr("Gig queued for publishing")
                : tr("Gig Published! 🎉")}
            </Text>
            <Text style={styles.successSubtitle}>
              {isEditMode
                ? tr("\"{{value0}}\" has been successfully updated and saved to Cloud Firestore.", { value0: form.title })
                : syncPending
                ? tr("\"{{value0}}\" is visible on this device and will sync to Firebase when the connection responds.", { value0: form.title })
                : tr("\"{{value0}}\" has been saved to Cloud Firestore and is now active on the marketplace.", { value0: form.title })}
            </Text>

            {/* Assigned Gig ID Badge */}
            {createdGigId ? (
              <View style={styles.gigIdBadge}>
                <Ionicons name="key-outline" size={13} color={colors.primary} />
                <Text style={styles.gigIdBadgeText}>{tr("ID:")}{' '}{createdGigId}</Text>
              </View>
            ) : null}

            <View style={styles.successSummaryBox}>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>{tr("Status:")}</Text>
                <Text style={styles.summaryStatusText}>
                  {isEditMode ? tr("🟢 Updated in Firebase") : tr("🟢 Open for applications")}
                </Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>{tr("Category:")}</Text>
                <Text style={styles.summaryValue}>{form.category}</Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>{tr("Pay:")}</Text>
                <Text style={styles.summaryValue}>
                  ${form.pay} ({form.payType === 'fixed' ? tr("Fixed") : tr("Hourly")})
                </Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>{tr("Date:")}</Text>
                <Text style={styles.summaryValue}>{form.date}</Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>{tr("Location:")}</Text>
                <Text style={styles.summaryValue}>{form.location || tr("Remote")}</Text>
              </View>
            </View>

            <View style={styles.successBtnStack}>
              {isEditMode ? (
                <>
                  <TouchableOpacity
                    style={styles.primaryModalBtn}
                    onPress={() => {
                      setShowSuccessModal(false);
                      router.replace({
                        pathname: '/(app)/gig/[id]',
                        params: { id: createdGigId || targetGigId },
                      } as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryModalBtnText}>{tr("View Updated Gig")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryModalBtn}
                    onPress={() => {
                      setShowSuccessModal(false);
                      router.replace('/(app)/(tabs)/my-gigs' as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryModalBtnText}>{tr("Back to My Gigs")}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.primaryModalBtn}
                    onPress={() => {
                      setShowSuccessModal(false);
                      router.replace('/(app)/(tabs)/home' as any);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryModalBtnText}>{tr("Go to Dashboard")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryModalBtn}
                    onPress={handleResetForm}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryModalBtnText}>{tr("+ Post Another Gig")}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Glowing background blobs

  // Navigation Bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleContainer: {
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  navSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorBannerTitle: {
    fontSize: 13,
    color: colors.error,
    fontFamily: fonts.bodyBold,
    marginBottom: 2,
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.error,
    lineHeight: 16,
  },
  retryBannerBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBannerBtnText: {
    color: colors.primaryOnColor,
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },

  // Section Cards
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },

  // Form Fields
  fieldGroup: {
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
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    minHeight: 110,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  fieldErrorText: {
    fontSize: 12,
    color: colors.error,
    fontFamily: fonts.bodyMedium,
  },

  // Category Selector
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
  },
  categoryChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },

  // Skill Tags
  skillInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  skillInputField: {
    flex: 1,
  },
  addSkillBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSkillBtnText: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  skillsChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  selectedSkillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  selectedSkillText: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
  removeSkillBtn: {
    padding: 2,
  },
  suggestedSkillsContainer: {
    marginTop: 12,
  },
  suggestedTitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    fontFamily: fonts.bodyMedium,
  },
  suggestedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  suggestedChip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 36,
    justifyContent: 'center',
  },
  suggestedChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Pay Type Toggle
  payTypeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  payTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  payTypeBtnActive: {
    backgroundColor: colors.primary,
  },
  payTypeBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodySemiBold,
  },
  payTypeBtnTextActive: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
  },

  // Currency Input
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.primary,
    marginRight: 6,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.bodyBold,
  },
  currencySuffix: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
  },

  // Budget Presets
  budgetPresetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  budgetPresetsLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 2,
  },
  presetChip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 36,
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.bodySemiBold,
  },
  presetChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },

  // Date Section
  datePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  dateChip: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  dateChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.bodySemiBold,
  },
  dateChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  customDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    minHeight: 36,
    justifyContent: 'center',
  },
  customDateBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  dateDisplayInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  dateDisplayText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    marginLeft: 8,
  },

  // Location Section
  locationTypeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  locationTypeCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  locationTypeCardActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  locationTypeLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.textSecondary,
  },
  locationTypeLabelActive: {
    color: colors.primary,
  },
  locationTypeDesc: {
    fontSize: 11,
    color: colors.textMuted,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },

  // Submit Button
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: colors.primaryOnColor,
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: 40,
  },

  // Modals Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  // Date Picker Modal
  datePickerModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  pickerColumnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.md,
  },
  pickerCol: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    alignItems: 'center',
  },
  pickerColLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    marginBottom: 6,
  },
  pickerItem: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.bodySemiBold,
  },
  pickerItemTextActive: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
  },
  modalDatePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
  },
  modalDatePreviewLabel: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
  },
  modalDatePreviewValue: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodySemiBold,
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalApplyBtnText: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
  },

  // Success Modal
  successModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
  },
  successIconCircle: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  gigIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginBottom: spacing.md,
  },
  gigIdBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  successSummaryBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 6,
  },
  successSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
  },
  summaryValue: {
    fontSize: 12,
    color: colors.text,
    fontFamily: fonts.bodyBold,
  },
  summaryStatusText: {
    fontSize: 12,
    color: colors.success,
    fontFamily: fonts.bodyBold,
  },
  successBtnStack: {
    width: '100%',
    gap: 8,
  },
  primaryModalBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryModalBtnText: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  secondaryModalBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryModalBtnText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
