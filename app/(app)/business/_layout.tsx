import { Stack } from 'expo-router';
import { colors } from '../../../constants/theme';
import { ApplicantsProvider } from '../../../context/ApplicantsContext';
import { BusinessGigsProvider } from '../../../context/BusinessGigsContext';

export default function BusinessLayout() {
  return (
    <BusinessGigsProvider>
      <ApplicantsProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="gig/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="applicant/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="post-gig" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </ApplicantsProvider>
    </BusinessGigsProvider>
  );
}
