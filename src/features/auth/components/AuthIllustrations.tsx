import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const consentAsset = require('../../../../assets/onboarding/consent-illustration.png');
const securityAsset = require('../../../../assets/onboarding/security-illustration.png');
const wordmarkDark = require('../../../../assets/brand/nitin-logo-white-transparent.png');

// Cartão da marca (referência: seção "Uso em contexto > Cartão" do brand book)
export function BrandCardIllustration() {
  return (
    <View style={styles.heroWrap}>
      <LinearGradient
        colors={['#022173', '#0A3FD4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.brandCard}
      >
        <View style={styles.brandCardTop}>
          <Image source={wordmarkDark} style={styles.brandCardWordmark} resizeMode="contain" />
          <View style={styles.brandCardChip} />
        </View>
        <Text style={styles.brandCardNumber}>•••• 4127</Text>
      </LinearGradient>
    </View>
  );
}

export function ConsentIllustration() {
  return (
    <View style={styles.iconWrap}>
      <Image source={consentAsset} style={styles.iconImage} resizeMode="contain" />
    </View>
  );
}

export function SecurityIllustration() {
  return (
    <View style={styles.iconWrap}>
      <Image source={securityAsset} style={styles.iconImage} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandCard: {
    width: 310,
    height: 190,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#02040C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  brandCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandCardWordmark: {
    width: 150,
    height: 70,
    marginTop: -22,
    marginLeft: -40,
  },
  brandCardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E7B84C',
  },
  brandCardNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 3,
  },
  iconWrap: {
    width: 208,
    height: 208,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 208,
    height: 208,
    borderRadius: 18,
  },
});
