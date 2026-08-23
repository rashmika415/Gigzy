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
} from 'react-native';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../FirebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';

export default function Profile() {
  const { user, userData, loading } = useAuth();
  
  // State for editable profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state with userData when loaded
  useEffect(() => {
    if (userData) {
      setFullName(userData.fullName || '');
      setPhone(userData.phone || '');
      setBio(userData.bio || '');
      setSkills(userData.skills || '');
    }
  }, [userData]);

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      setErrorMsg('Full Name cannot be empty.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        skills: skills.trim(),
      });
      setSuccessMsg('Profile updated successfully! ✨');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  const getRoleLabel = () => {
    if (userData?.role === 'admin') return 'Platform Admin';
    if (userData?.role === 'client') return 'Business Owner';
    return 'Youth (Freelancer)';
  };

  if (loading) {
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
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>User Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {(fullName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileName}>{fullName || 'Gigzy User'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{getRoleLabel()}</Text>
              </View>
              <Text style={styles.emailText}>{user?.email}</Text>
            </View>
          </View>

          {/* Edit Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit Profile Info</Text>

            {/* Success / Error Banners */}
            {successMsg ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(t) => { setFullName(t); setErrorMsg(''); }}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 019-2834"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself, your background, or what you are looking for..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Skills */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Skills / Specialties</Text>
              <TextInput
                style={styles.input}
                value={skills}
                onChangeText={setSkills}
                placeholder="e.g. Logo Design, React Native, Copywriting"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>Save Profile Details</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign Out Action */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
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
  backButton: {
    padding: spacing.xs,
  },
  backIcon: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  roleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  emailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 8,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    textAlignVertical: 'top',
    height: 100,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signOutButton: {
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
  successBox: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
