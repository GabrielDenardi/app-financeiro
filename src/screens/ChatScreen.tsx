import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack } from 'expo-router';

export default function ChatScreen () {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const navigation = useNavigation<any>();

    const { id, name } = useLocalSearchParams();


    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: name || `Chat ${id}`}} />
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </Pressable>

                <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle}>Pessoa? {id}</Text>
                    <Text style={styles.headerSubtitle}>Conversa com o {name}...</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background
    },

    //Title
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    pressed: {
        opacity: 0.85,
    },
    headerCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    headerTitle: {
        ...typography.h1,
        color: colors.textPrimary,
    },
    headerSubtitle: {
        ...typography.body,
        color: colors.textSecondary
    },
})

