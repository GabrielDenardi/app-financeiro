import { Image, StyleSheet, View } from 'react-native';

const heroAsset = require('../../../../assets/onboarding/hero-onboarding.png');
const consentAsset = require('../../../../assets/onboarding/consent-illustration.png');
const securityAsset = require('../../../../assets/onboarding/security-illustration.png');

export function HeroCardsIllustration() {
  return (
    <View style={styles.heroWrap}>
      <Image source={heroAsset} style={styles.heroImage} resizeMode="contain" />
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
  heroImage: {
    width: 332,
    height: 320,
    borderRadius: 20,
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
