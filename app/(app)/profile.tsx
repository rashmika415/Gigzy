import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../FirebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius } from '../../constants/theme';

export default function Profile() {
  const { user, userData, loading } = useAuth();

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

  const role = userData?.role || 'freelancer';
  const isYouth = role === 'freelancer';

  // Extract skills into an array of tags
  const skillsArray = userData?.skills
    ? userData.skills.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>User Profile</Text>
          <TouchableOpacity
            onPress={() => router.push('/(app)/edit-profile' as any)}
            style={styles.editHeaderButton}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {userData?.photoURL ? (
              <Image source={{ uri: userData.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {(userData?.fullName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.profileName}>
              {isYouth ? (userData?.fullName || 'Youth Member') : (userData?.businessName || 'Business Owner')}
            </Text>
            <View style={[styles.roleBadge, { borderColor: isYouth ? 'rgba(245, 158, 11, 0.3)' : 'rgba(124, 58, 237, 0.3)' }]}>
              <Text style={[styles.roleText, { color: isYouth ? colors.primary : colors.accent }]}>{getRoleLabel()}</Text>
            </View>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>
        </View>

        {/* Role-Specific Content */}
        {isYouth ? (
          // Youth Profile Fields
          <View style={styles.detailsSection}>
            {/* Bio Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About Me</Text>
              <Text style={styles.cardContentText}>
                {userData?.bio || "No bio has been added yet. Edit your profile to tell the community about yourself!"}
              </Text>
            </View>

            {/* Skills Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Skills & Specialties</Text>
              {skillsArray.length > 0 ? (
                <View style={styles.skillsContainer}>
                  {skillsArray.map((skill, index) => (
                    <View key={index} style={styles.skillTag}>
                      <Text style={styles.skillTagText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedText}>No skills specified yet.</Text>
              )}
            </View>

            {/* Availability & Contact Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Work & Contact Details</Text>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} style={styles.rowIcon} />
                <View>
                  <Text style={styles.detailLabel}>Availability</Text>
                  <Text style={styles.detailValue}>{userData?.availability || 'Not specified'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={18} color={colors.primary} style={styles.rowIcon} />
                <View>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>{userData?.phone || 'Not specified'}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          // Business Profile Fields
          <View style={styles.detailsSection}>
            {/* Business Details Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Business Profile & Details</Text>
              <View style={styles.detailRow}>
                <Ionicons name="business-outline" size={18} color={colors.accent} style={styles.rowIcon} />
                <View>
                  <Text style={styles.detailLabel}>Contact Person</Text>
                  <Text style={styles.detailValue}>{userData?.fullName || 'Not specified'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="pricetag-outline" size={18} color={colors.accent} style={styles.rowIcon} />
                <View>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>{userData?.businessCategory || 'Not specified'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={18} color={colors.accent} style={styles.rowIcon} />
                <View>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{userData?.location || 'Not specified'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={18} color={colors.accent} style={styles.rowIcon} />
                <View>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>{userData?.phone || 'Not specified'}</Text>
                </View>
              </View>
            </View>

            {/* Business Description Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About the Business</Text>
              <Text style={styles.cardContentText}>
                {userData?.businessDetails || "No description has been added yet. Edit your profile to tell freelancers about your business!"}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/(app)/edit-profile' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color="#000" style={styles.buttonIcon} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} style={styles.buttonIcon} />
            <Text style={styles.signOutText}>Sign Out Account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  editHeaderButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
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
    width: '100%',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detailsSection: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContentText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  mutedText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skillTag: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  skillTagText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  rowIcon: {
    width: 24,
    textAlign: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  actionSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
    width: '100%',
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  editButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonIcon: {
    marginRight: 2,
  },
  signOutButton: {
    borderRadius: borderRadius.full,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    gap: spacing.sm,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
});
