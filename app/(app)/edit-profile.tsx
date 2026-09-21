import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  BackHandler,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../FirebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { GIG_CATEGORIES } from '../../types/gig';
import { parseFirebaseError } from '../../services/gigService';
import { ProfileValidationErrors } from '../../types/profile';

const AVAILABILITY_OPTIONS = [
  'Full-Time',
  'Part-Time',
  'Weekends Only',
  'Freelance / Project-Based',
];

export default function EditProfile() {
  const { user, userData } = useAuth();

  // Initialization flag
  const [isInitialized, setIsInitialized] = useState(false);

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  
  // Youth specific
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [availability, setAvailability] = useState('');

  // Business specific
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessDetails, setBusinessDetails] = useState('');
  const [location, setLocation] = useState('');

  // UI Flow States
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<ProfileValidationErrors>({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const role = userData?.role || 'freelancer';
  const isYouth = role === 'freelancer';

  // Load existing profile data
  useEffect(() => {
    if (userData && !isInitialized) {
      setFullName(userData.fullName || '');
      setPhone(userData.phone || '');
      setPhotoURL(userData.photoURL || '');
      setBio(userData.bio || '');
      setSkills(userData.skills || '');
      setAvailability(userData.availability || '');
      setBusinessName(userData.businessName || '');
      setBusinessCategory(userData.businessCategory || '');
      setBusinessDetails(userData.businessDetails || '');
      setLocation(userData.location || '');
      setIsInitialized(true);
    }
  }, [userData, isInitialized]);

  // Compute unsaved changes dynamically
  const checkHasUnsavedChanges = () => {
    if (!userData) return false;
    const initialFullName = userData.fullName || '';
    const initialPhone = userData.phone || '';
    const initialPhotoURL = userData.photoURL || '';
    const initialBio = userData.bio || '';
    const initialSkills = userData.skills || '';
    const initialAvailability = userData.availability || '';
    const initialBusinessName = userData.businessName || '';
    const initialBusinessCategory = userData.businessCategory || '';
    const initialBusinessDetails = userData.businessDetails || '';
    const initialLocation = userData.location || '';

    return (
      fullName !== initialFullName ||
      phone !== initialPhone ||
      photoURL !== initialPhotoURL ||
      bio !== initialBio ||
      skills !== initialSkills ||
      availability !== initialAvailability ||
      businessName !== initialBusinessName ||
      businessCategory !== initialBusinessCategory ||
      businessDetails !== initialBusinessDetails ||
      location !== initialLocation
    );
  };

  const hasUnsavedChanges = checkHasUnsavedChanges();

  // Handle Cancel / Go Back with warning
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Unsaved Changes?',
        'You have unsaved changes in your profile form. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Android Back Press integration
  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          'Discard Unsaved Changes?',
          'You have unsaved changes in your profile form. Are you sure you want to discard them?',
          [
            { text: 'Keep Editing', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => router.back(),
            },
          ]
        );
        return true; // prevent default go back
      }
      return false; // go back normally
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [hasUnsavedChanges]);

  // Image Picking and Uploading
  const handlePickImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'We need access to your photos to upload a profile photo/logo. Please enable it in settings.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        await uploadImageToFirebase(localUri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const uploadImageToFirebase = async (uri: string) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Save file name with a timestamp to avoid native caching issues
      const filename = `avatar_${Date.now()}.jpg`;
      const storageRef = ref(storage, `profiles/${user.uid}/${filename}`);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      setPhotoURL(downloadURL);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Upload Failed', 'Failed to upload photo to Firebase Storage. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: ProfileValidationErrors = {};

    if (isYouth) {
      // Youth validation
      if (!fullName.trim()) {
        newErrors.fullName = 'Full Name is required.';
      }
      
      const trimmedBio = bio.trim();
      if (trimmedBio.length > 0 && trimmedBio.length < 10) {
        newErrors.bio = 'Bio must be at least 10 characters long.';
      } else if (trimmedBio.length > 500) {
        newErrors.bio = 'Bio cannot exceed 500 characters.';
      }

      if (!skills.trim()) {
        newErrors.skills = 'Please enter at least one skill.';
      }

      if (!availability.trim()) {
        newErrors.availability = 'Please select your availability.';
      }
    } else {
      // Business validation
      if (!businessName.trim()) {
        newErrors.businessName = 'Business Name is required.';
      }

      if (!businessCategory.trim()) {
        newErrors.businessCategory = 'Please select a business category.';
      }

      const trimmedDetails = businessDetails.trim();
      if (!trimmedDetails) {
        newErrors.businessDetails = 'Business details are required.';
      } else if (trimmedDetails.length < 20) {
        newErrors.businessDetails = 'Please provide detailed business information (min 20 characters).';
      } else if (trimmedDetails.length > 1000) {
        newErrors.businessDetails = 'Business details cannot exceed 1,000 characters.';
      }

      if (!location.trim()) {
        newErrors.location = 'Contact/Location details are required.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Save Profile
  const handleSave = async () => {
    if (!user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Validation Error', 'Please correct the errors in the form before saving.');
      return;
    }

    setSaving(true);
    setSuccessMsg('');

    try {
      const userRef = doc(db, 'users', user.uid);
      
      let profileData: Record<string, any> = {
        uid: user.uid,
        role,
        photoURL: photoURL.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      };

      if (isYouth) {
        profileData = {
          ...profileData,
          fullName: fullName.trim(),
          bio: bio.trim(),
          skills: skills.trim(),
          availability: availability.trim(),
        };
      } else {
        profileData = {
          ...profileData,
          fullName: fullName.trim() || user.displayName || 'Business Owner',
          businessName: businessName.trim(),
          businessCategory: businessCategory.trim(),
          businessDetails: businessDetails.trim(),
          location: location.trim(),
        };
      }

      // Write to Firestore (creates doc if doesn't exist, updates if it does)
      await setDoc(userRef, profileData, { merge: true });

      setSuccessMsg('Profile updated successfully! ✨');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setSuccessMsg('');
        router.back();
      }, 1500);

    } catch (e: any) {
      console.error(e);
      Alert.alert('Save Failed', parseFirebaseError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Text style={styles.headerButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.headerButton, saving && styles.disabledButton]}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.headerButtonText, styles.saveText]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Success Banner */}
          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Photo Upload Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.photoContainer}
              disabled={uploadingImage}
              activeOpacity={0.8}
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoFallback}>
                  <Text style={styles.photoFallbackText}>
                    {(fullName?.[0] ?? userData?.fullName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}

              {uploadingImage ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={16} color="#000" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.photoHelperText}>
              {isYouth ? 'Tap to upload profile photo' : 'Tap to upload business logo'}
            </Text>
          </View>

          {/* Edit Form */}
          <View style={styles.card}>
            {isYouth ? (
              // YOUTH PROFILE FIELDS
              <View>
                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput
                    style={[styles.input, errors.fullName && styles.inputErrorBorder]}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      setErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                    placeholder="Enter your full name"
                    placeholderTextColor={colors.textMuted}
                  />
                  {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                </View>

                {/* Phone Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter your phone number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Bio */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Bio</Text>
                    <Text style={styles.charCount}>{bio.length}/500</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, errors.bio && styles.inputErrorBorder]}
                    value={bio}
                    onChangeText={(text) => {
                      setBio(text);
                      setErrors((prev) => ({ ...prev, bio: undefined }));
                    }}
                    placeholder="Tell us about yourself, your background, and goals..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                  />
                  {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
                </View>

                {/* Skills */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Skills / Specialties *</Text>
                  <TextInput
                    style={[styles.input, errors.skills && styles.inputErrorBorder]}
                    value={skills}
                    onChangeText={(text) => {
                      setSkills(text);
                      setErrors((prev) => ({ ...prev, skills: undefined }));
                    }}
                    placeholder="Comma separated: e.g. Design, Coding, Delivery"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.fieldHelp}>Separate skills with commas (e.g. Design, Painting, Sales)</Text>
                  {errors.skills && <Text style={styles.errorText}>{errors.skills}</Text>}
                </View>

                {/* Availability Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Availability *</Text>
                  <View style={styles.chipsContainer}>
                    {AVAILABILITY_OPTIONS.map((option) => {
                      const isSelected = availability === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          onPress={() => {
                            setAvailability(option);
                            setErrors((prev) => ({ ...prev, availability: undefined }));
                          }}
                          style={[
                            styles.chip,
                            isSelected && styles.chipActive,
                            errors.availability && styles.inputErrorBorder,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.availability && <Text style={styles.errorText}>{errors.availability}</Text>}
                </View>
              </View>
            ) : (
              // BUSINESS PROFILE FIELDS
              <View>
                {/* Business Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Business Name *</Text>
                  <TextInput
                    style={[styles.input, errors.businessName && styles.inputErrorBorder]}
                    value={businessName}
                    onChangeText={(text) => {
                      setBusinessName(text);
                      setErrors((prev) => ({ ...prev, businessName: undefined }));
                    }}
                    placeholder="Enter business name"
                    placeholderTextColor={colors.textMuted}
                  />
                  {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
                </View>

                {/* Business Category Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Business Category *</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.selectorInput, errors.businessCategory && styles.inputErrorBorder]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowCategoryModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.selectorText, !businessCategory && styles.selectorTextPlaceholder]}>
                      {businessCategory || 'Select Business Category'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {errors.businessCategory && <Text style={styles.errorText}>{errors.businessCategory}</Text>}
                </View>

                {/* Contact/Location */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contact & Location *</Text>
                  <TextInput
                    style={[styles.input, errors.location && styles.inputErrorBorder]}
                    value={location}
                    onChangeText={(text) => {
                      setLocation(text);
                      setErrors((prev) => ({ ...prev, location: undefined }));
                    }}
                    placeholder="e.g. Colombo, Sri Lanka / Remote"
                    placeholderTextColor={colors.textMuted}
                  />
                  {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
                </View>

                {/* Contact Phone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contact Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter business contact phone"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Business Details */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Business Description *</Text>
                    <Text style={styles.charCount}>{businessDetails.length}/1000</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, errors.businessDetails && styles.inputErrorBorder]}
                    value={businessDetails}
                    onChangeText={(text) => {
                      setBusinessDetails(text);
                      setErrors((prev) => ({ ...prev, businessDetails: undefined }));
                    }}
                    placeholder="Detail what your business does and why freelancers should work with you (min 20 characters)..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={6}
                    maxLength={1000}
                  />
                  {errors.businessDetails && <Text style={styles.errorText}>{errors.businessDetails}</Text>}
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.disabledButton]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>Save Profile Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CATEGORY MODAL */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {GIG_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setBusinessCategory(cat.name);
                    setShowCategoryModal(false);
                    setErrors((prev) => ({ ...prev, businessCategory: undefined }));
                  }}
                  style={[
                    styles.modalItem,
                    businessCategory === cat.name && styles.modalItemActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={20}
                    color={businessCategory === cat.name ? colors.primary : colors.textSecondary}
                    style={styles.modalItemIcon}
                  />
                  <Text style={[styles.modalItemText, businessCategory === cat.name && styles.modalItemTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  saveText: {
    color: colors.primary,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  successBox: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'relative',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  photoFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.primary,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHelperText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    color: colors.text,
    fontSize: 15,
  },
  inputErrorBorder: {
    borderColor: colors.error,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  fieldHelp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  selectorInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 15,
    color: colors.text,
  },
  selectorTextPlaceholder: {
    color: colors.textMuted,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f1322',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '65%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalCloseIcon: {
    padding: spacing.xs,
  },
  modalList: {
    paddingHorizontal: spacing.lg,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalItemActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  modalItemIcon: {
    marginRight: spacing.md,
    width: 24,
    textAlign: 'center',
  },
  modalItemText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modalItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
