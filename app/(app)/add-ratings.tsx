import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/LocalizedText';
import RateUserButton from '../../components/RateUserButton';
import { db } from '../../FirebaseConfig';
import { useAuth, type UserData } from '../../context/AuthContext';
import { subscribeToClientGigs } from '../../services/gigService';
import { getReviewTarget } from '../../services/reviewService';
import { borderRadius, colors, fonts, spacing } from '../../constants/theme';
import type { Gig } from '../../types/gig';

export default function AddRatingsScreen() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [seekers, setSeekers] = useState<UserData[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [search, setSearch] = useState('');
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [gigsLoading, setGigsLoading] = useState(true);
  const [peopleError, setPeopleError] = useState(false);
  const [gigsError, setGigsError] = useState(false);
  const [retry, setRetry] = useState(0);
  const isBusiness = !!user && userData?.role === 'client';
  useEffect(() => {
    if (!isBusiness || !user) return;
    const stopPeople = onSnapshot(query(collection(db, 'users'), where('role', 'in', ['freelancer', 'youth'])), snapshot => {
      setSeekers(snapshot.docs.map(item => ({ ...item.data(), uid: item.id }) as UserData));
      setPeopleLoading(false); setPeopleError(false);
    }, () => { setPeopleLoading(false); setPeopleError(true); });
    const stopGigs = subscribeToClientGigs(user.uid, items => {
      setGigs(items); setGigsLoading(false); setGigsError(false);
    }, () => { setGigsLoading(false); setGigsError(true); });
    return () => { stopPeople(); stopGigs(); };
  }, [isBusiness, user, retry]);
  const loading = peopleLoading || gigsLoading;
  const failed = peopleError || gigsError;
  const filtered = seekers.filter(person => person.uid !== user?.uid && person.fullName?.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Back')} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={styles.title}>{t('Add Ratings')}</Text></View>
    {!isBusiness ? <Text style={styles.message}>{t('Only business users can add ratings.')}</Text> : <>
      <TextInput style={styles.search} placeholder={t('Search job seekers')} accessibilityLabel={t('Search job seekers')} placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      {loading ? <ActivityIndicator color={colors.primary} /> : failed ? <View style={styles.message}><Text style={styles.text}>{t('Could not load job seekers.')}</Text><TouchableOpacity style={styles.back} onPress={() => { setPeopleLoading(true); setGigsLoading(true); setRetry(value => value + 1); }}><Text style={styles.link}>{t('Retry')}</Text></TouchableOpacity></View> :
        <FlatList data={filtered} keyExtractor={item => item.uid} contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.text}>{t('No job seekers found.')}</Text>}
          renderItem={({ item }) => {
            const completed = gigs.filter(gig => getReviewTarget(gig, user?.uid, 'client') === item.uid);
            return <View style={styles.card}>
              <TouchableOpacity accessibilityRole="button" style={styles.person} onPress={() => router.push({ pathname: '/(app)/profile/[id]', params: { id: item.uid } })}>
                {item.photoURL ? <Image source={{ uri: item.photoURL }} style={styles.avatar} /> : <View style={[styles.avatar, styles.fallback]}><Text style={styles.title}>{item.fullName?.[0]?.toUpperCase() || '?'}</Text></View>}
                <View style={styles.info}><Text style={styles.name}>{item.fullName || t('Freelancer')}</Text><Text style={styles.link}>{t('View profile')}</Text></View>
              </TouchableOpacity>
              {completed.length ? completed.map(gig => <View key={gig.id} style={styles.gig}><Text style={styles.text}>{gig.title}</Text><RateUserButton key={gig.id} gig={gig} /></View>) : <Text style={styles.muted}>{t('Complete a gig with this job seeker to rate them.')}</Text>}
            </View>;
          }} />}
    </>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  back: { padding: spacing.sm, minHeight: 44 },
  title: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.text },
  search: { margin: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: borderRadius.md, color: colors.text },
  list: { padding: spacing.md, gap: spacing.md },
  card: { padding: spacing.md, borderRadius: borderRadius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, gap: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  fallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primaryLight },
  info: { flex: 1 }, name: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 16 },
  link: { color: colors.primary }, text: { color: colors.text }, muted: { color: colors.textMuted, lineHeight: 20 },
  gig: { gap: spacing.sm, paddingTop: spacing.sm }, message: { padding: spacing.lg },
});
