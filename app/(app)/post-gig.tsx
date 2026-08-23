import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { GIG_CATEGORIES, GigInput, GigValidationErrors, LocationType } from '../../types/gig';
import { createGig, validateGigForm } from '../../services/gigService';

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

export default function PostGigScreen() {
  const { user, userData } = useAuth();

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
  const [submitError, setSubmitError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

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

  // Animation values
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const handlePressOut = () =>
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  // Field change handler with live validation update
  const handleChange = (field: keyof GigInput, value: any) => {
    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);

    if (touched[field]) {
      const { errors: newErrors } = validateGigForm(updatedForm);
      setErrors((prev) => ({
        ...prev,
        [field]: newErrors[field],
      }));
    }
  };

  const handleBlur = (field: keyof GigInput) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const { errors: newErrors } = validateGigForm(form);
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
    setForm((prev) => ({ ...prev, skills: [...prev.skills, text] }));
    setSkillInput('');
    setErrors((prev) => ({ ...prev, skills: undefined }));
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  // Date selection presets
  const handleSelectDatePreset = (daysOffset: number) => {
    const formatted = getFormattedDate(daysOffset);
    handleChange('date', formatted);
    setTouched((prev) => ({ ...prev, date: true }));
  };

  // Custom date picker apply
  const handleApplyDatePicker = () => {
    const yyyy = pickerDate.year;
    const mm = String(pickerDate.month).padStart(2, '0');
    const dd = String(pickerDate.day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    handleChange('date', dateStr);
    setTouched((prev) => ({ ...prev, date: true }));
    setShowDatePickerModal(false);
  };

  // Form Submission
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

    const { isValid, errors: validationErrors } = validateGigForm(form);
    setErrors(validationErrors);

    if (!isValid) {
      setSubmitError('Please fix the errors in the form before submitting.');
      return;
    }

    if (!user) {
      setSubmitError('You must be logged in to post a gig.');
      return;
    }

    setSubmitError('');
    setLoading(true);

    try {
      await createGig(form, {
        uid: user.uid,
        fullName: userData?.fullName || user.displayName || 'Business Owner',
        email: userData?.email || user.email || '',
      });

      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error posting gig:', err);
      setSubmitError(err?.message || 'Failed to post gig. Please try again.');
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
    setShowSuccessModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background glowing decorations */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>Post a New Gig</Text>
          <Text style={styles.navSubtitle}>Reach active freelancers & local youth</Text>
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
          {/* Submission Error Banner */}
          {submitError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorBannerText}>{submitError}</Text>
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
              <Text style={styles.sectionTitle}>1. Gig Overview</Text>
            </View>

            {/* Gig Title */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>
                  Gig Title <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <Text style={styles.charCount}>{form.title.length}/100</Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  touched.title && errors.title ? styles.inputError : null,
                ]}
                placeholder="e.g. Build Landing Page, Repair Kitchen Pipe, Yard Care..."
                placeholderTextColor={colors.textMuted}
                value={form.title}
                onChangeText={(val) => handleChange('title', val)}
                onBlur={() => handleBlur('title')}
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
              <Text style={styles.label}>
                Category <Text style={styles.requiredAsterisk}>*</Text>
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
                        handleChange('category', cat.name);
                        setTouched((prev) => ({ ...prev, category: true }));
                      }}
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
                        {cat.name}
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
              <Text style={styles.sectionTitle}>2. Details & Requirements</Text>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>
                  Detailed Description <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <Text style={styles.charCount}>{form.description.length}/2500</Text>
              </View>
              <TextInput
                style={[
                  styles.textArea,
                  touched.description && errors.description ? styles.inputError : null,
                ]}
                placeholder="Explain the job scope, required deliverables, tools needed, and expectations..."
                placeholderTextColor={colors.textMuted}
                value={form.description}
                onChangeText={(val) => handleChange('description', val)}
                onBlur={() => handleBlur('description')}
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
              <Text style={styles.label}>Required Skills or Tags (Optional)</Text>
              <View style={styles.skillInputRow}>
                <TextInput
                  style={[styles.input, styles.skillInputField]}
                  placeholder="e.g. React, Fast Worker, Lift 40lbs..."
                  placeholderTextColor={colors.textMuted}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onSubmitEditing={() => handleAddSkill()}
                />
                <TouchableOpacity
                  style={styles.addSkillBtn}
                  onPress={() => handleAddSkill()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="#080B14" />
                  <Text style={styles.addSkillBtnText}>Add</Text>
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
                <Text style={styles.suggestedTitle}>Suggested:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.suggestedRow}>
                    {SUGGESTED_SKILLS.filter((s) => !form.skills.includes(s)).map((skill) => (
                      <TouchableOpacity
                        key={skill}
                        style={styles.suggestedChip}
                        onPress={() => handleAddSkill(skill)}
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
              <Text style={styles.sectionTitle}>3. Compensation</Text>
            </View>

            {/* Pay Type Toggle */}
            <View style={styles.payTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.payTypeBtn,
                  form.payType === 'fixed' && styles.payTypeBtnActive,
                ]}
                onPress={() => handleChange('payType', 'fixed')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="wallet-outline"
                  size={16}
                  color={form.payType === 'fixed' ? '#080B14' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.payTypeBtnText,
                    form.payType === 'fixed' && styles.payTypeBtnTextActive,
                  ]}
                >
                  Fixed Price ($)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.payTypeBtn,
                  form.payType === 'hourly' && styles.payTypeBtnActive,
                ]}
                onPress={() => handleChange('payType', 'hourly')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={form.payType === 'hourly' ? '#080B14' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.payTypeBtnText,
                    form.payType === 'hourly' && styles.payTypeBtnTextActive,
                  ]}
                >
                  Hourly Rate ($/hr)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pay Amount Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {form.payType === 'fixed' ? 'Total Gig Budget ($)' : 'Hourly Rate ($/hr)'}{' '}
                <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View
                style={[
                  styles.currencyInputContainer,
                  touched.pay && errors.pay ? styles.inputError : null,
                ]}
              >
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput
                  style={styles.currencyInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={form.pay}
                  onChangeText={(val) => handleChange('pay', val)}
                  onBlur={() => handleBlur('pay')}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currencySuffix}>
                  {form.payType === 'fixed' ? 'USD' : 'USD / hr'}
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
                <Text style={styles.budgetPresetsLabel}>Quick pick:</Text>
                {BUDGET_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      form.pay === preset && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      handleChange('pay', preset);
                      setTouched((prev) => ({ ...prev, pay: true }));
                    }}
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
              <Text style={styles.sectionTitle}>4. Date & Deadline</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Gig Date / Needed By <Text style={styles.requiredAsterisk}>*</Text>
              </Text>

              {/* Quick Date Chips */}
              <View style={styles.datePresetsRow}>
                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    form.date === getFormattedDate(0) && styles.dateChipActive,
                  ]}
                  onPress={() => handleSelectDatePreset(0)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      form.date === getFormattedDate(0) && styles.dateChipTextActive,
                    ]}
                  >
                    ⚡ Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    form.date === getFormattedDate(1) && styles.dateChipActive,
                  ]}
                  onPress={() => handleSelectDatePreset(1)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      form.date === getFormattedDate(1) && styles.dateChipTextActive,
                    ]}
                  >
                    Tomorrow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    form.date === getFormattedDate(7) && styles.dateChipActive,
                  ]}
                  onPress={() => handleSelectDatePreset(7)}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      form.date === getFormattedDate(7) && styles.dateChipTextActive,
                    ]}
                  >
                    In 1 Week
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.customDateBtn}
                  onPress={() => setShowDatePickerModal(true)}
                >
                  <Ionicons name="calendar" size={14} color={colors.primary} />
                  <Text style={styles.customDateBtnText}>Custom</Text>
                </TouchableOpacity>
              </View>

              {/* Date Display / Input */}
              <TouchableOpacity
                style={[
                  styles.dateDisplayInput,
                  touched.date && errors.date ? styles.inputError : null,
                ]}
                onPress={() => setShowDatePickerModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-clear-outline" size={18} color={colors.primary} />
                <Text style={styles.dateDisplayText}>
                  {form.date ? `Target Date: ${form.date}` : 'Select a date'}
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
              <Text style={styles.sectionTitle}>5. Location & Work Setup</Text>
            </View>

            {/* Location Type Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Work Arrangement</Text>
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
                        handleChange('locationType', item.type);
                        if (item.type === 'remote' && !form.location) {
                          handleChange('location', 'Remote');
                        }
                      }}
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
                        {item.label}
                      </Text>
                      <Text style={styles.locationTypeDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location Address / City Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                {form.locationType === 'remote'
                  ? 'Location / Timezone Note (Optional)'
                  : 'City, Address or Area'}{' '}
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
                      ? 'e.g. Worldwide, US Timezones, etc.'
                      : 'e.g. Brooklyn NY, 124 Main Street, Downtown...'
                  }
                  placeholderTextColor={colors.textMuted}
                  value={form.location}
                  onChangeText={(val) => handleChange('location', val)}
                  onBlur={() => handleBlur('location')}
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
                  <ActivityIndicator color="#080B14" size="small" />
                  <Text style={styles.submitButtonText}>Publishing Gig...</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="paper-plane" size={18} color="#080B14" />
                  <Text style={styles.submitButtonText}>Post Gig Now</Text>
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
              <Text style={styles.datePickerModalTitle}>Select Target Date</Text>
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
                <Text style={styles.pickerColLabel}>Year</Text>
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
                <Text style={styles.pickerColLabel}>Month</Text>
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const monthNames = [
                      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
                          {monthNames[m - 1]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Day */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>Day</Text>
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
              <Text style={styles.modalDatePreviewLabel}>Selected Date:</Text>
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
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyDatePicker}
              >
                <Text style={styles.modalApplyBtnText}>Apply Date</Text>
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
              <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            </View>

            <Text style={styles.successTitle}>Gig Posted Successfully! 🎉</Text>
            <Text style={styles.successSubtitle}>
              {`"${form.title}" is now live on the Gigzy marketplace. Freelancers can now view and apply.`}
            </Text>

            <View style={styles.successSummaryBox}>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>Category:</Text>
                <Text style={styles.summaryValue}>{form.category}</Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>Pay:</Text>
                <Text style={styles.summaryValue}>
                  ${form.pay} ({form.payType === 'fixed' ? 'Fixed' : 'Hourly'})
                </Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>Date:</Text>
                <Text style={styles.summaryValue}>{form.date}</Text>
              </View>
              <View style={styles.successSummaryRow}>
                <Text style={styles.summaryLabel}>Location:</Text>
                <Text style={styles.summaryValue}>{form.location || 'Remote'}</Text>
              </View>
            </View>

            <View style={styles.successBtnStack}>
              <TouchableOpacity
                style={styles.primaryModalBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.replace('/(app)/home' as any);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryModalBtnText}>Go to Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryModalBtn}
                onPress={handleResetForm}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryModalBtnText}>+ Post Another Gig</Text>
              </TouchableOpacity>
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
  blob1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primaryGlow,
    opacity: 0.3,
  },
  blob2: {
    position: 'absolute',
    bottom: 120,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accentLight,
    opacity: 0.25,
  },

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
    fontWeight: '800',
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
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: colors.primary,
    fontWeight: '700',
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
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
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
    color: '#080B14',
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '500',
  },
  suggestedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  suggestedChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    fontWeight: '600',
  },
  payTypeBtnTextActive: {
    color: '#080B14',
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.primary,
    marginRight: 6,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  currencySuffix: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  presetChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Date Section
  datePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  dateChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dateChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
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
  },
  customDateBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
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
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    fontWeight: '700',
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
    color: '#080B14',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: 40,
  },

  // Modals Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  // Date Picker Modal
  datePickerModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
  },
  pickerItem: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: '#080B14',
    fontWeight: '800',
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
    fontWeight: '600',
  },
  modalDatePreviewValue: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '800',
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
    fontWeight: '600',
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalApplyBtnText: {
    color: '#080B14',
    fontWeight: '700',
  },

  // Success Modal
  successModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
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
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
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
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
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
    color: '#080B14',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryModalBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryModalBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
