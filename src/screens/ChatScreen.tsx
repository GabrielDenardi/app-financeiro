import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { AlignJustify, FileInput, HeartIcon } from 'lucide-react-native';
import { Card } from '../components/Card';
import { timeoutManager } from '@tanstack/react-query';

interface ChatRouteParams {
    chatId: string;
    chatTitle: string;
}

const chatMessages = [
  {
    id: '1',
    sender: 'user_1',
    text: 'Olá! Tudo bem? Como está o progresso do projeto?',
    side: 'left',
    timestamp: '10:00',
    status: 'read',
  },
  {
    id: '2',
    sender: 'me',
    text: 'Oi! Está indo muito bem. Acabei de finalizar a parte do front-end do chat.',
    side: 'right',
    timestamp: '10:01',
    status: 'read',
  },
  {
    id: '3',
    sender: 'me',
    text: 'O que você achou do layout que te mandei mais cedo?',
    side: 'right',
    timestamp: '10:01',
    status: 'read',
  },
  {
    id: '4',
    sender: 'user_1',
    text: 'Ficou excelente! As cores e o espaçamento estão bem profissionais. Só precisamos ajustar o ícone de anexo.',
    side: 'left',
    timestamp: '10:05',
    status: 'read',
  },
  {
    id: '5',
    sender: 'me',
    text: 'Perfeito, vou mexer nisso agora mesmo! 🚀',
    side: 'right',
    timestamp: '10:06',
    status: 'delivered',
  },
  {
    id: '6',
    sender: 'user_1',
    text: 'Combinado! Aproveita e dá uma olhada no fluxo de notificações também.',
    side: 'left',
    timestamp: '10:10',
    status: 'read',
  },
  {
    id: '7',
    sender: 'user_1',
    text: 'Ah, outra coisa: você acha que conseguimos implementar o modo escuro ainda essa semana?',
    side: 'left',
    timestamp: '10:11',
    status: 'read',
  },
  {
    id: '8',
    sender: 'me',
    text: 'Acredito que sim! Já deixei as variáveis de cores preparadas para o tema dark.',
    side: 'right',
    timestamp: '10:15',
    status: 'sent',
  },
  {
    id: '9',
    sender: 'me',
    text: 'Vou subir o primeiro commit com essas correções em 20 minutos.',
    side: 'right',
    timestamp: '10:16',
    status: 'sent',
  },
  {
    id: '10',
    sender: 'user_1',
    text: 'Show! Fico no aguardo aqui para testar.',
    side: 'left',
    timestamp: '10:20',
    status: 'read',
  },
];

export default function ChatScreen () {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const navigation = useNavigation<any>();

    const route = useRoute();
    const params = route.params as ChatRouteParams

    const [settingsMenu, setSettingsMenu] = useState(false);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex: 1}}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </Pressable>

                    <View style={styles.headerCopy}>
                        <View style={styles.headerUser}>
                            <Ionicons name='people-outline' size={30}/>
                            <Text style={styles.headerTitle}>{params.chatTitle}</Text>
                        </View>

                        <TouchableOpacity onPress={() => setSettingsMenu(!settingsMenu)}>
                            <Ionicons name='ellipsis-vertical-circle-outline' size={30} />
                        </TouchableOpacity>
                    </View>
                </View>

                {settingsMenu && (
                    <View style={styles.settingsModal}>
                        <Ionicons name='cog-outline' />
                    </View>
                )}

                <ScrollView>
                    {chatMessages.map((item) => (
                        <View style={item.side === 'left' ? styles.groupMessageLeft : styles.groupMessageRight} key={item.id}>
                            <Ionicons name='person-outline' size={20} style={{marginTop: 15}} />
                            <Card style={styles.cardMessage}>
                                <Text style={styles.textMessage}>{item.text}</Text>
                                <Text style={styles.timeMessage}>{item.timestamp}</Text>
                            </Card>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.actionsSection}>
                    <View style={styles.inputSection}>
                        <TextInput 
                            style={styles.textInput}
                            placeholder='Escreva sua mensagem.' 
                            multiline={true}
                            scrollEnabled={true}
                        />
                        <TouchableOpacity>
                            <Ionicons name='attach-outline' size={25} />
                        </TouchableOpacity>
                        <TouchableOpacity>
                            <View style={styles.sendInput}>
                                <Ionicons name='send-outline' size={25} style={{color: colors.white}} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
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
        borderBottomWidth: 1,
        borderColor: colors.border,
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
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    headerTitle: {
        ...typography.h2,
        color: colors.textPrimary,
    },
    headerUser: {
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'center'
    },

    //Massages
    groupMessageLeft: {
        flexDirection: 'row',
        gap: 10,
        padding: 10
    },
    groupMessageRight: {
        flexDirection: 'row-reverse',
        gap: 10,
        padding: 10
    },
    cardMessage: {
        maxWidth: '80%',
        minWidth: '50%',
        minHeight: 30,
        maxHeight: 300,
    },
    textMessage: {
        ...typography.body,
        marginBottom: 10,
    },
    timeMessage: {
        position: 'absolute',
        right: 10,
        bottom: 5,
        ...typography.caption,
        fontSize: 10,
    },

    //Actions
    actionsSection: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: 0,
        width: '100%', 
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderColor: colors.border,
    },
    inputSection: {
        flex: 1, 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.mutedSurface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 25,
        paddingHorizontal: 15,
        gap: 10,
        marginTop: 10,
        marginBottom: 5,
    },
    textInput: {
        flex: 1,
        paddingVertical: 8,
        fontSize: 16,
        color: '#333',
    },
    sendInput: {
        backgroundColor: colors.primaryLight,
        width: 45,
        height: 45,
        borderRadius: radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2, 
        shadowColor: colors.shadow, 
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },

    //Modal
    settingsModal: {
        height: 10,
        width: 10
    }
})

