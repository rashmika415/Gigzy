import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../FirebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { borderRadius, colors, spacing } from '../../constants/theme';

export default function SuspendedScreen() {
  const { userData } = useAuth();
  return <View style={styles.container}><Ionicons name="ban-outline" size={54} color={colors.error}/><Text style={styles.title}>Account suspended</Text><Text style={styles.body}>{userData?.suspensionReason || 'This account is temporarily unavailable. Contact support if you believe this is a mistake.'}</Text><TouchableOpacity style={styles.button} onPress={() => signOut(auth)}><Text style={styles.buttonText}>Sign out</Text></TouchableOpacity></View>;
}
const styles=StyleSheet.create({container:{flex:1,alignItems:'center',justifyContent:'center',padding:spacing.xl,backgroundColor:colors.background},title:{fontSize:25,fontWeight:'800',color:colors.text,marginTop:spacing.lg},body:{fontSize:15,lineHeight:22,color:colors.textSecondary,textAlign:'center',marginTop:spacing.sm,maxWidth:360},button:{marginTop:spacing.xl,borderRadius:borderRadius.full,borderWidth:1,borderColor:colors.error,paddingHorizontal:spacing.xl,paddingVertical:12},buttonText:{color:colors.error,fontWeight:'700'}});
