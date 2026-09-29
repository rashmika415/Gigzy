import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { UserData } from '../../../context/AuthContext';
import { subscribeToProfile, subscribeToProfileReviews } from '../../../services/profileService';
import { ProfileReview } from '../../../types/profile';
import { borderRadius, colors, spacing } from '../../../constants/theme';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserData | null>(null);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    const stopProfile = subscribeToProfile(id, (value) => { setProfile(value); setLoading(false); }, () => setLoading(false));
    const stopReviews = subscribeToProfileReviews(id, setReviews, () => {});
    return () => { stopProfile(); stopReviews(); };
  }, [id]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!profile) return <View style={styles.center}><Text style={styles.title}>Profile not found</Text></View>;
  const youth = profile.role === 'freelancer';
  const name = youth ? profile.fullName : profile.businessName || profile.fullName;
  const skills = profile.skills?.split(',').map((skill) => skill.trim()).filter(Boolean) ?? [];
  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text}/></TouchableOpacity><Text style={styles.headerTitle}>Profile</Text><View style={{width:24}}/></View>
    <View style={styles.hero}>{profile.photoURL ? <Image source={{uri:profile.photoURL}} style={styles.avatar}/> : <View style={styles.fallback}><Text style={styles.initial}>{name?.[0]?.toUpperCase()}</Text></View>}
      <View style={styles.nameRow}><Text style={styles.name}>{name}</Text>{!youth && profile.isVerified && <Ionicons name="checkmark-circle" size={21} color={colors.primary}/>}</View>
      <Text style={styles.role}>{youth ? 'Youth freelancer' : profile.businessCategory || 'Business'}</Text>
      <View style={styles.rating}><Ionicons name="star" size={16} color="#FBBF24"/><Text style={styles.ratingText}>{(profile.ratingAverage ?? 0).toFixed(1)} · {profile.ratingCount ?? reviews.length} reviews</Text></View>
    </View>
    <Card title={youth ? 'About' : 'Business description'}><Text style={styles.body}>{youth ? profile.bio || 'No bio yet.' : profile.businessDetails || 'No description yet.'}</Text></Card>
    <Card title="Details"><Text style={styles.body}>{profile.location || profile.address || 'Location not provided'}</Text>{youth && profile.age ? <Text style={styles.body}>Age {profile.age}</Text> : null}<Text style={styles.body}>{profile.availability || profile.phone || ''}</Text></Card>
    {youth && skills.length > 0 && <Card title="Skills"><View style={styles.tags}>{skills.map((skill) => <View key={skill} style={styles.tag}><Text style={styles.tagText}>{skill}</Text></View>)}</View></Card>}
    {youth && !!profile.skillBadges?.length && <Card title="Earned badges"><View style={styles.tags}>{profile.skillBadges.map((badge) => <View key={badge.id} style={styles.badge}><Ionicons name="ribbon" size={15} color={colors.primary}/><Text style={styles.tagText}>{badge.label}</Text></View>)}</View></Card>}
    {youth && !!profile.endorsements?.length && <Card title="Community endorsements">{profile.endorsements.map((item) => <Text key={item.id} style={styles.body}>✓ {item.skill} · {item.endorserName}</Text>)}</Card>}
    <Card title="Reviews">{reviews.length ? reviews.map((review) => <View key={review.id} style={styles.review}><View style={styles.reviewHead}><Text style={styles.reviewName}>{review.authorName}</Text><Text style={styles.reviewStars}>{'★'.repeat(Math.round(review.rating))}</Text></View><Text style={styles.body}>{review.comment}</Text></View>) : <Text style={styles.muted}>No reviews yet.</Text>}</Card>
  </ScrollView></View>;
}

function Card({title,children}:{title:string;children:React.ReactNode}) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{children}</View>; }
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background},content:{padding:spacing.lg,paddingTop:48,paddingBottom:spacing.xxl},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:spacing.lg},headerTitle:{fontSize:19,fontWeight:'800',color:colors.text},hero:{alignItems:'center',marginBottom:spacing.lg},avatar:{width:96,height:96,borderRadius:48,borderWidth:2,borderColor:colors.primary},fallback:{width:96,height:96,borderRadius:48,alignItems:'center',justifyContent:'center',backgroundColor:colors.primaryLight,borderWidth:2,borderColor:colors.primary},initial:{fontSize:38,fontWeight:'800',color:colors.primary},nameRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:spacing.md},name:{fontSize:23,fontWeight:'800',color:colors.text},title:{fontSize:20,color:colors.text},role:{fontSize:13,color:colors.textSecondary,marginTop:3},rating:{flexDirection:'row',gap:5,marginTop:spacing.sm},ratingText:{color:colors.textSecondary,fontSize:13},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.surfaceBorder,borderRadius:borderRadius.xl,padding:spacing.lg,marginBottom:spacing.md},cardTitle:{fontSize:13,fontWeight:'800',color:colors.textSecondary,textTransform:'uppercase',marginBottom:spacing.sm},body:{fontSize:14,color:colors.text,lineHeight:21,marginBottom:3},muted:{fontSize:14,color:colors.textMuted},tags:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},tag:{paddingHorizontal:10,paddingVertical:6,borderRadius:borderRadius.full,backgroundColor:colors.primaryLight},badge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:borderRadius.full,backgroundColor:colors.primaryLight},tagText:{fontSize:12,fontWeight:'700',color:colors.primary},review:{paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.surfaceBorder},reviewHead:{flexDirection:'row',justifyContent:'space-between',marginBottom:4},reviewName:{fontWeight:'700',color:colors.text},reviewStars:{color:'#FBBF24'}});
