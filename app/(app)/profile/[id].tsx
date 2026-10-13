import ProfileRatingActions from '../../../components/ProfileRatingActions';
import { ReviewSummary, ReviewHistory } from '../../../components/ProfileReviews';
import { useProfileReviews } from '../../../hooks/useProfileReviews';
import { Text } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { UserData } from '../../../context/AuthContext';
import { subscribeToProfile } from '../../../services/profileService';
import { borderRadius, colors, spacing, fonts } from '../../../constants/theme';

export default function PublicProfileScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserData | null>(null);
  const reviewState = useProfileReviews(id);
  const [loading, setLoading] = useState(true);
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
      <ReviewSummary {...reviewState} />
    </View>
    {youth && <ProfileRatingActions key={id} userId={id} />}
    <Card title={youth ? t("About") : t("Business description")}><Text style={styles.body}>{youth ? profile.bio || t("No bio yet.") : profile.businessDetails || t("No description yet.")}</Text></Card>
    <Card title={t("Details")}><Text style={styles.body}>{profile.location || profile.address || t("Location not provided")}</Text>{youth && profile.age ? <Text style={styles.body}>{t('Age: {{age}}', { age: profile.age })}</Text> : null}<Text style={styles.body}>{profile.availability || profile.phone || ''}</Text></Card>
    {youth && skills.length > 0 && <Card title={t("Skills")}><View style={styles.tags}>{skills.map((skill) => <View key={skill} style={styles.tag}><Text style={styles.tagText}>{skill}</Text></View>)}</View></Card>}
    {youth && !!profile.skillBadges?.length && <Card title={t("Earned badges")}><View style={styles.tags}>{profile.skillBadges.map((badge) => <View key={badge.id} style={styles.badge}><Ionicons name="ribbon" size={15} color={colors.primary}/><Text style={styles.tagText}>{badge.label}</Text></View>)}</View></Card>}
    {youth && !!profile.endorsements?.length && <Card title={t("Community endorsements")}>{profile.endorsements.map((item) => <Text key={item.id} style={styles.body}>✓ {item.skill} · {item.endorserName}</Text>)}</Card>}
    <ReviewHistory {...reviewState} />
  </ScrollView></View>;
}

function Card({title,children}:{title:string;children:React.ReactNode}) {
  const { t } = useTranslation(); return <View style={styles.card}><Text style={styles.cardTitle}>{t(title)}</Text>{children}</View>; }
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},content:{padding:spacing.lg,paddingTop:48,paddingBottom:spacing.xxl},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:spacing.lg},headerTitle:{fontSize:19,fontFamily: fonts.bodyBold,color:colors.text},hero:{alignItems:'center',marginBottom:spacing.lg},avatar:{width:96,height:96,borderRadius:48,borderWidth:2,borderColor:colors.primary},fallback:{width:96,height:96,borderRadius:48,alignItems:'center',justifyContent:'center',backgroundColor:colors.primaryLight,borderWidth:2,borderColor:colors.primary},initial:{fontSize:38,fontFamily: fonts.display,color:colors.primary},nameRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:spacing.md},name:{fontSize:23,fontFamily: fonts.heading,color:colors.text},title:{fontSize:20,color:colors.text},role:{fontSize:13,color:colors.textSecondary,marginTop:3},rating:{flexDirection:'row',gap:5,marginTop:spacing.sm},ratingText:{color:colors.textSecondary,fontSize:13},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.surfaceBorder,borderRadius:borderRadius.xl,padding:spacing.lg,marginBottom:spacing.md},cardTitle:{fontSize:13,fontFamily: fonts.bodyBold,color:colors.textSecondary,textTransform:'uppercase',marginBottom:spacing.sm},body:{fontSize:14,color:colors.text,lineHeight:21,marginBottom:3},muted:{fontSize:14,color:colors.textMuted},tags:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},tag:{paddingHorizontal:10,paddingVertical:6,borderRadius:borderRadius.full,backgroundColor:colors.primaryLight},badge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:borderRadius.full,backgroundColor:colors.primaryLight},tagText:{fontSize:12,fontFamily: fonts.bodyBold,color:colors.primary},review:{paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.surfaceBorder},reviewHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:4},reviewName:{fontFamily: fonts.bodyBold,color:colors.text},reviewStars:{color:colors.warning}});
