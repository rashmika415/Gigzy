import { Text } from '../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../FirebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { borderRadius, colors, spacing, fonts } from '../../constants/theme';

export default function SuspendedScreen() {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const until = (userData?.suspendedUntil as { toDate?: () => Date } | undefined)?.toDate?.();
  const temporary = userData?.suspensionType === 'temporary' && until && !Number.isNaN(until.getTime());
  return <View style={styles.container}><Ionicons name="ban-outline" size={54} color={colors.error}/><Text style={styles.title}>{t(temporary ? 'Temporary suspension' : 'Account suspended')}</Text><Text style={styles.body}>{userData?.suspensionReason || t("This account is temporarily unavailable. Contact support if you believe this is a mistake.")}</Text>{temporary && <Text style={styles.until}>{t('Access returns after {{date}}', { date: until.toLocaleString() })}</Text>}<TouchableOpacity style={styles.button} onPress={() => signOut(auth)}><Text style={styles.buttonText}>{t("Sign out")}</Text></TouchableOpacity></View>;
}
const styles=StyleSheet.create({container:{flex:1,alignItems:'center',justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},title:{fontSize:25,fontFamily: fonts.heading,color:colors.text,marginTop:spacing.lg},body:{fontSize:15,lineHeight:22,color:colors.textSecondary,textAlign:'center',marginTop:spacing.sm,maxWidth:360},until:{fontSize:14,lineHeight:21,color:colors.error,textAlign:'center',marginTop:spacing.sm,fontFamily:fonts.bodySemiBold},button:{marginTop:spacing.xl,borderRadius:borderRadius.full,borderWidth:1,borderColor:colors.error,paddingHorizontal:spacing.xl,paddingVertical:12},buttonText:{color:colors.error,fontFamily: fonts.bodyBold}});
