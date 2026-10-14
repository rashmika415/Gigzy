import ProfileRatingActions from '../../../components/ProfileRatingActions';
import { ReviewSummary, ReviewHistory } from '../../../components/ProfileReviews';
import { useProfileReviews } from '../../../hooks/useProfileReviews';
import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { UserData, useAuth } from '../../../context/AuthContext';
import { subscribeToProfile, subscribeToProfileReviews } from '../../../services/profileService';
import { ProfileReview } from '../../../types/profile';
import { RatingModal } from '../../../components/reviews';
import { borderRadius, colors, spacing, fonts } from '../../../constants/theme';

export default function PublicProfileScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserData | null>(null);
  const reviewState = useProfileReviews(id);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  useEffect(() => {
    if (!id) return;
    const stopProfile = subscribeToProfile(id, (value) => { setProfile(value); setLoading(false); }, () => setLoading(false));
    return () => { stopProfile(); };
  }, [id]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!profile) return <View style={styles.center}><Text style={styles.title}>{t("Profile not found")}</Text></View>;
  const youth = profile.role === 'freelancer';
  const name = youth ? profile.fullName : profile.businessName || profile.fullName;
  const skills = profile.skills?.split(',').map((skill) => skill.trim()).filter(Boolean) ?? [];
  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text}/></TouchableOpacity><Text style={styles.headerTitle}>{t("Profile")}</Text><View style={{width:24}}/></View>
    <View style={styles.hero}>{profile.photoURL ? <Image source={{uri:profile.photoURL}} style={styles.avatar}/> : <View style={styles.fallback}><Text style={styles.initial}>{name?.[0]?.toUpperCase()}</Text></View>}
      <View style={styles.nameRow}><Text style={styles.name}>{name}</Text>{!youth && profile.isVerified && <Ionicons name="checkmark-circle" size={21} color={colors.primary}/>}</View>
      <Text style={styles.role}>{youth ? t("Youth freelancer") : profile.businessCategory || t("Business")}</Text>
      <View style={styles.rating}><Ionicons name="star" size={16} color={colors.star}/><Text style={styles.ratingText}>{t('{{rating}} · Reviews: {{count}}', { rating: formatNumber(profile.ratingAverage ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), count: profile.ratingCount ?? reviews.length })}</Text></View>
      {user && user.uid !== profile.uid && (
        <TouchableOpacity
          style={styles.leaveReviewBtn}
          onPress={() => setShowRatingModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="star" size={14} color={colors.primaryOnColor} />
          <Text style={styles.leaveReviewBtnText}>{t("Leave a Review")}</Text>
        </TouchableOpacity>
      )}
    </View>
    {youth && <ProfileRatingActions key={id} userId={id} />}
    <Card title={youth ? t("About") : t("Business description")}><Text style={styles.body}>{youth ? profile.bio || t("No bio yet.") : profile.businessDetails || t("No description yet.")}</Text></Card>
    <Card title={t("Details")}><Text style={styles.body}>{profile.location || profile.address || t("Location not provided")}</Text>{youth && profile.age ? <Text style={styles.body}>{t('Age: {{age}}', { age: profile.age })}</Text> : null}<Text style={styles.body}>{profile.availability || profile.phone || ''}</Text></Card>
    {youth && skills.length > 0 && <Card title={t("Skills")}><View style={styles.tags}>{skills.map((skill) => <View key={skill} style={styles.tag}><Text style={styles.tagText}>{skill}</Text></View>)}</View></Card>}
    {youth && !!profile.skillBadges?.length && <Card title={t("Earned badges")}><View style={styles.tags}>{profile.skillBadges.map((badge) => <View key={badge.id} style={styles.badge}><Ionicons name="ribbon" size={15} color={colors.primary}/><Text style={styles.tagText}>{badge.label}</Text></View>)}</View></Card>}
    {youth && !!profile.endorsements?.length && <Card title={t("Community endorsements")}>{profile.endorsements.map((item) => <Text key={item.id} style={styles.body}>✓ {item.skill} · {item.endorserName}</Text>)}</Card>}
    <Card title={t("Reviews")}>
      {reviews.length ? reviews.map((review) => (
        <View key={review.id} style={styles.review}>
          <View style={styles.reviewHead}>
            <Text style={styles.reviewName}>{review.authorName}</Text>
            <Text style={styles.reviewStars}>{'★'.repeat(Math.round(review.rating))}</Text>
          </View>
          {Boolean(review.tags && review.tags.length > 0) && (
            <View style={styles.reviewTagsRow}>
              {review.tags!.map((tag, tIdx) => (
                <View key={tIdx} style={styles.reviewTagChip}>
                  <Text style={styles.reviewTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.body}>{review.comment}</Text>
        </View>
      )) : <Text style={styles.muted}>{t("No reviews yet.")}</Text>}
    </Card>
  </ScrollView>
  <RatingModal
    visible={showRatingModal}
    onClose={() => setShowRatingModal(false)}
    targetUserId={profile.uid}
    targetUserName={name || 'User'}
    targetUserPhotoURL={profile.photoURL}
    targetRole={profile.role as 'freelancer' | 'client'}
    onSuccess={() => {}}
  />
  </View>;
}

function Card({title,children}:{title:string;children:React.ReactNode}) {
  const { t } = useTranslation(); return <View style={styles.card}><Text style={styles.cardTitle}>{t(title)}</Text>{children}</View>; }
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},content:{padding:spacing.lg,paddingTop:48,paddingBottom:spacing.xxl},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:spacing.lg},headerTitle:{fontSize:19,fontFamily: fonts.bodyBold,color:colors.text},hero:{alignItems:'center',marginBottom:spacing.lg},avatar:{width:96,height:96,borderRadius:48,borderWidth:2,borderColor:colors.primary},fallback:{width:96,height:96,borderRadius:48,alignItems:'center',justifyContent:'center',backgroundColor:colors.primaryLight,borderWidth:2,borderColor:colors.primary},initial:{fontSize:38,fontFamily: fonts.display,color:colors.primary},nameRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:spacing.md},name:{fontSize:23,fontFamily: fonts.heading,color:colors.text},title:{fontSize:20,color:colors.text},role:{fontSize:13,color:colors.textSecondary,marginTop:3},rating:{flexDirection:'row',gap:5,marginTop:spacing.sm},ratingText:{color:colors.textSecondary,fontSize:13},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.surfaceBorder,borderRadius:borderRadius.xl,padding:spacing.lg,marginBottom:spacing.md},cardTitle:{fontSize:13,fontFamily: fonts.bodyBold,color:colors.textSecondary,textTransform:'uppercase',marginBottom:spacing.sm},body:{fontSize:14,color:colors.text,lineHeight:21,marginBottom:3},muted:{fontSize:14,color:colors.textMuted},tags:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},tag:{paddingHorizontal:10,paddingVertical:6,borderRadius:borderRadius.full,backgroundColor:colors.primaryLight},badge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:borderRadius.full,backgroundColor:colors.primaryLight},tagText:{fontSize:12,fontFamily: fonts.bodyBold,color:colors.primary},review:{paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.surfaceBorder},reviewHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:4},reviewName:{fontFamily: fonts.bodyBold,color:colors.text},reviewStars:{color:colors.warning},
reviewTagsRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginVertical:4},
reviewTagChip:{backgroundColor:'rgba(245, 158, 11, 0.12)',borderWidth:1,borderColor:'rgba(245, 158, 11, 0.3)',borderRadius:borderRadius.full,paddingHorizontal:8,paddingVertical:2},
reviewTagText:{fontSize:11,fontFamily:fonts.bodySemiBold,color:'#D97706'},
leaveReviewBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:colors.primary,paddingHorizontal:16,paddingVertical:8,borderRadius:borderRadius.full,marginTop:spacing.md,shadowColor:colors.primary,shadowOffset:{width:0,height:2},shadowOpacity:0.25,shadowRadius:4,elevation:2},
leaveReviewBtnText:{color:colors.primaryOnColor,fontFamily:fonts.bodyBold,fontSize:13}});
