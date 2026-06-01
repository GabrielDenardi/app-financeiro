import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import type { AccountBalanceSnapshot } from '../../accounts/types';
import { useCreateTransactionMutation } from '../hooks/useTransactions';
import {
  deleteTransactionAttachment,
  parseTransactionFromOcr,
  parseTransactionFromVoice,
  pickDocumentFile,
  pickImageFromCamera,
  pickImageFromLibrary,
  uploadTransactionAttachment,
  type LocalCaptureFile,
} from '../services/transactionCaptureService';
import type {
  CapturedTransactionDraft,
  CreateTransactionInput,
  EntryType,
  FinanceCategory,
  PaymentMethod,
} from '../types';

type QuickAddTransactionSheetProps = {
  visible: boolean;
  currentUserId?: string | null;
  accounts: AccountBalanceSnapshot[];
  categories: FinanceCategory[];
  primaryAccountId?: string | null;
  onClose: () => void;
};

type CaptureMode = 'manual' | 'voice' | 'ocr';
type SheetStep = 'mode' | 'review';

const PAYMENT_METHODS: PaymentMethod[] = [
  'Pix',
  'Transferencia',
  'Dinheiro',
  'Cartao de debito',
  'Cartao de credito',
  'Boleto',
];

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatCentsToDisplay(digits: string): string {
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const int = padded.slice(0, -2).replace(/^0+/, '') || '0';
  const dec = padded.slice(-2);
  return `${int},${dec}`;
}

function amountToCents(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  return String(Math.round(value * 100));
}

function fallbackTitleForMode(mode: CaptureMode) {
  return mode === 'voice' ? 'Lancamento por voz' : mode === 'ocr' ? 'Lancamento por OCR' : 'Lancamento rapido';
}

function toOccurredAt(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function categoryMatchesEntryType(category: FinanceCategory, entryType: EntryType) {
  return category.kind === 'both' || category.kind === entryType;
}

export function QuickAddTransactionSheet({
  visible,
  currentUserId,
  accounts,
  categories,
  primaryAccountId,
  onClose,
}: QuickAddTransactionSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const createTransactionMutation = useCreateTransactionMutation(currentUserId);
  const [recorderRevision, setRecorderRevision] = useState(0);
  const recorderOptions = useMemo(
    () => ({
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: recorderRevision % 2 === 1,
    }),
    [recorderRevision],
  );
  const recorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(recorder);

  const [step, setStep] = useState<SheetStep>('mode');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('manual');
  const [type, setType] = useState<EntryType>('expense');
  const [title, setTitle] = useState('');
  const [amountDigits, setAmountDigits] = useState('');
  const [accountId, setAccountId] = useState(primaryAccountId ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [notes, setNotes] = useState('');
  const [occurredOn, setOccurredOn] = useState(formatDateInput(new Date()));
  const [recurring, setRecurring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LocalCaptureFile | null>(null);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);
  const [rawCaptureText, setRawCaptureText] = useState('');
  const [captureConfidence, setCaptureConfidence] = useState<number | null>(null);
  const [merchantOrIssuer, setMerchantOrIssuer] = useState<string | null>(null);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseLabel, setParseLabel] = useState('');

  const getCategoriesForType = useCallback(
    (entryType: EntryType) => categories.filter((category) => categoryMatchesEntryType(category, entryType)),
    [categories],
  );

  const resolveCategoryIdForType = useCallback(
    (entryType: EntryType, currentCategoryId: string | null) => {
      const categoryOptions = getCategoriesForType(entryType);

      if (currentCategoryId && categoryOptions.some((category) => category.id === currentCategoryId)) {
        return currentCategoryId;
      }

      return categoryOptions[0]?.id ?? null;
    },
    [getCategoriesForType],
  );

  const filteredCategories = useMemo(() => getCategoriesForType(type), [getCategoriesForType, type]);

  const resetState = () => {
    setStep('mode');
    setCaptureMode('manual');
    setType('expense');
    setTitle('');
    setAmountDigits('');
    setAccountId(primaryAccountId ?? accounts.find((account) => account.isActive)?.id ?? accounts[0]?.id ?? '');
    setCategoryId(null);
    setPaymentMethod('Pix');
    setNotes('');
    setOccurredOn(formatDateInput(new Date()));
    setRecurring(false);
    setSelectedFile(null);
    setDraftWarnings([]);
    setRawCaptureText('');
    setCaptureConfidence(null);
    setMerchantOrIssuer(null);
    setDocumentNumber(null);
    setIsParsing(false);
    setParseLabel('');
  };

  useEffect(() => {
    if (visible) {
      setRecorderRevision((current) => current + 1);
      resetState();
    }
  }, [visible, primaryAccountId]);

  useEffect(() => {
    setCategoryId((current) => resolveCategoryIdForType(type, current));
  }, [resolveCategoryIdForType, type]);

  const handleTypeChange = (nextType: EntryType) => {
    setType(nextType);
    setCategoryId((current) => resolveCategoryIdForType(nextType, current));
  };

  const applyDraft = (draft: CapturedTransactionDraft, mode: Exclude<CaptureMode, 'manual'>) => {
    const nextType = draft.type ?? 'expense';
    const matchedCategory =
      draft.suggestedCategoryCode
        ? categories.find(
            (category) =>
              category.code === draft.suggestedCategoryCode && categoryMatchesEntryType(category, nextType),
          )
        : null;

    const nextDate = draft.occurredAt ? formatDateInput(new Date(draft.occurredAt)) : formatDateInput(new Date());
    const nextWarnings =
      draft.warnings.length > 0
        ? draft.warnings
        : draft.occurredAt
          ? []
          : ['A data nao foi encontrada com seguranca. Revise antes de salvar.'];

    setCaptureMode(mode);
    setType(nextType);
    setTitle(draft.title?.trim() || draft.merchantOrIssuer?.trim() || fallbackTitleForMode(mode));
    setAmountDigits(amountToCents(draft.amount));
    setPaymentMethod((PAYMENT_METHODS.includes(draft.paymentMethod as PaymentMethod)
      ? draft.paymentMethod
      : 'Pix') as PaymentMethod);
    setOccurredOn(nextDate);
    setCategoryId(resolveCategoryIdForType(nextType, matchedCategory?.id ?? null));
    setNotes(draft.notes ?? '');
    setDraftWarnings(nextWarnings);
    setRawCaptureText(draft.rawTranscriptOrOcrText ?? '');
    setCaptureConfidence(draft.confidence ?? null);
    setMerchantOrIssuer(draft.merchantOrIssuer ?? null);
    setDocumentNumber(draft.documentNumber ?? null);
    setStep('review');
  };

  const handleParseFile = async (mode: Exclude<CaptureMode, 'manual'>, file: LocalCaptureFile) => {
    setSelectedFile(file);
    setCaptureMode(mode);
    setIsParsing(true);
    setParseLabel(mode === 'voice' ? 'Analisando audio...' : 'Lendo documento...');

    try {
      const draft = mode === 'voice' ? await parseTransactionFromVoice(file) : await parseTransactionFromOcr(file);
      applyDraft(draft, mode);
    } catch (error) {
      Alert.alert('Captura', error instanceof Error ? error.message : 'Nao foi possivel interpretar o arquivo.');
    } finally {
      setIsParsing(false);
      setParseLabel('');
    }
  };

  const handleManualStart = () => {
    setCaptureMode('manual');
    setStep('review');
  };

  const handlePickFromCamera = async () => {
    try {
      const file = await pickImageFromCamera();
      if (file) {
        await handleParseFile('ocr', file);
      }
    } catch (error) {
      Alert.alert('OCR', error instanceof Error ? error.message : 'Nao foi possivel abrir a camera.');
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const file = await pickImageFromLibrary();
      if (file) {
        await handleParseFile('ocr', file);
      }
    } catch (error) {
      Alert.alert('OCR', error instanceof Error ? error.message : 'Nao foi possivel abrir a galeria.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const file = await pickDocumentFile();
      if (file) {
        await handleParseFile('ocr', file);
      }
    } catch (error) {
      Alert.alert('OCR', error instanceof Error ? error.message : 'Nao foi possivel abrir o documento.');
    }
  };

  const stopActiveRecordingIfNeeded = async () => {
    if (!recorderState.isRecording) {
      return;
    }

    try {
      await recorder.stop();
    } finally {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      setRecorderRevision((current) => current + 1);
    }
  };

  const handleClose = async () => {
    try {
      await stopActiveRecordingIfNeeded();
    } catch {
      // Closing should not leave the sheet stuck if the native recorder was already released.
    } finally {
      onClose();
    }
  };

  const handleStartRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Voz', 'Permissao de microfone negada.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setCaptureMode('voice');
      setDraftWarnings([]);
    } catch (error) {
      setRecorderRevision((current) => current + 1);
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } catch {
        // Best-effort audio session reset after a failed native recorder call.
      }
      Alert.alert('Voz', error instanceof Error ? error.message : 'Nao foi possivel iniciar a gravacao.');
    }
  };

  const handleStopRecording = async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (!recorder.uri) {
        throw new Error('Nenhum audio foi gerado.');
      }

      const file: LocalCaptureFile = {
        uri: recorder.uri,
        name: `voice-${Date.now()}${Platform.OS === 'web' ? '.webm' : '.m4a'}`,
        mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        size: 0,
      };

      await handleParseFile('voice', file);
    } catch (error) {
      Alert.alert('Voz', error instanceof Error ? error.message : 'Nao foi possivel finalizar a gravacao.');
    } finally {
      setRecorderRevision((current) => current + 1);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) {
      Alert.alert('Transacao', 'Usuario nao autenticado.');
      return;
    }

    if (!accountId) {
      Alert.alert('Transacao', 'Selecione uma conta.');
      return;
    }

    const parsedAmount = amountDigits ? Number(amountDigits) / 100 : 0;
    if (parsedAmount <= 0) {
      Alert.alert('Transacao', 'Informe um valor valido.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Transacao', 'Informe uma descricao.');
      return;
    }

    let uploadedAttachment:
      | Awaited<ReturnType<typeof uploadTransactionAttachment>>
      | null = null;

    try {
      if (captureMode !== 'manual' && selectedFile) {
        uploadedAttachment = await uploadTransactionAttachment({
          file: selectedFile,
          attachmentKind: captureMode === 'voice' ? 'audio_note' : 'ocr_document',
          sourceType: captureMode,
          captureMetadata: {
            warnings: draftWarnings,
            rawText: rawCaptureText,
            confidence: captureConfidence,
            merchantOrIssuer,
            documentNumber,
          },
        });
      }

      const safeCategoryId = resolveCategoryIdForType(type, categoryId);
      if (safeCategoryId !== categoryId) {
        setCategoryId(safeCategoryId);
      }

      const payload: CreateTransactionInput = {
        accountId,
        categoryId: safeCategoryId,
        title: title.trim(),
        amount: Number(parsedAmount.toFixed(2)),
        type,
        paymentMethod,
        occurredAt: toOccurredAt(occurredOn),
        notes: notes.trim(),
        isRecurring: recurring,
        sourceType: captureMode,
        attachmentId: uploadedAttachment?.id ?? null,
        captureMetadata:
          captureMode === 'manual'
            ? undefined
            : {
                provider: 'openai',
                confidence: captureConfidence,
                warnings: draftWarnings,
                transcript: captureMode === 'voice' ? rawCaptureText : undefined,
                ocrText: captureMode === 'ocr' ? rawCaptureText : undefined,
                merchantOrIssuer,
                documentNumber,
              },
      };

      await createTransactionMutation.mutateAsync(payload);
      await handleClose();
    } catch (error) {
      if (uploadedAttachment) {
        try {
          await deleteTransactionAttachment(uploadedAttachment);
        } catch {
          // Best-effort rollback for orphan attachments.
        }
      }

      Alert.alert('Transacao', error instanceof Error ? error.message : 'Nao foi possivel salvar a transacao.');
    }
  };

  const renderModeStep = () => (
    <View style={styles.contentBlock}>
      <Text style={styles.sheetTitle}>Como você quer preencher?</Text>
      <Text style={styles.sheetSubtitle}>Escolha o modo de captura. A revisao final acontece antes de salvar.</Text>

      <View style={styles.modeList}>
        <Pressable style={styles.modeCard} onPress={handleManualStart}>
          <Text style={styles.modeTitle}>Manual</Text>
          <Text style={styles.modeText}>Preenchimento completo no formulario.</Text>
        </Pressable>

        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>Por voz</Text>
          <Text style={styles.modeText}>Grave um resumo curto e deixe a IA montar o rascunho.</Text>
          <Pressable
            style={[
              styles.primaryButton,
              styles.modeCardActionButton,
              recorderState.isRecording && styles.recordingButton,
            ]}
            onPress={recorderState.isRecording ? handleStopRecording : handleStartRecording}
            disabled={isParsing}
          >
            <Text style={styles.primaryButtonText}>
              {recorderState.isRecording ? 'Parar e analisar' : 'Gravar audio'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>Leitura OCR</Text>
          <Text style={styles.modeText}>Use camera, galeria ou PDF para ler uma NF ou notinha.</Text>
          <View style={styles.inlineActions}>
            <Pressable style={styles.secondaryButton} onPress={handlePickFromCamera} disabled={isParsing}>
              <Text style={styles.secondaryButtonText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handlePickFromLibrary} disabled={isParsing}>
              <Text style={styles.secondaryButtonText}>Galeria</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handlePickDocument} disabled={isParsing}>
              <Text style={styles.secondaryButtonText}>PDF</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isParsing ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{parseLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reviewContent}>
      <View style={styles.contentBlock}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sheetTitle}>Revisar lancamento</Text>
            <Text style={styles.sheetSubtitle}>
              {captureMode === 'manual'
                ? 'Confira os dados antes de salvar.'
                : 'O rascunho foi preenchido automaticamente e pode ser ajustado.'}
            </Text>
          </View>
          <Pressable style={styles.backButton} onPress={() => setStep('mode')}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        </View>

        <View style={styles.typeRow}>
          {(['expense', 'income'] as EntryType[]).map((entryType) => (
            <Pressable
              key={entryType}
              onPress={() => handleTypeChange(entryType)}
              style={[
                styles.typeChip,
                entryType === type && (entryType === 'expense' ? styles.typeChipExpense : styles.typeChipIncome),
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  entryType === type && (entryType === 'expense' ? styles.typeChipTextExpense : styles.typeChipTextIncome),
                ]}
              >
                {entryType === 'expense' ? 'Despesa' : 'Receita'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          placeholder="Descricao"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
        />
        <TextInput
          placeholder="0,00"
          value={formatCentsToDisplay(amountDigits)}
          onChangeText={(text) => setAmountDigits(text.replace(/\D/g, '').replace(/^0+/, ''))}
          keyboardType="numeric"
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
        />
        <TextInput
          placeholder="Data (YYYY-MM-DD)"
          value={occurredOn}
          onChangeText={setOccurredOn}
          style={styles.input}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Conta</Text>
        <View style={styles.wrapRow}>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              onPress={() => setAccountId(account.id)}
              style={[styles.filterChip, accountId === account.id && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, accountId === account.id && styles.filterChipTextActive]}>
                {account.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.wrapRow}>
          {filteredCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[styles.filterChip, categoryId === category.id && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, categoryId === category.id && styles.filterChipTextActive]}>
                {category.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Metodo</Text>
        <View style={styles.wrapRow}>
          {PAYMENT_METHODS.map((method) => (
            <Pressable
              key={method}
              onPress={() => setPaymentMethod(method)}
              style={[styles.filterChip, paymentMethod === method && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, paymentMethod === method && styles.filterChipTextActive]}>
                {method}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          placeholder="Observacoes"
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notesInput]}
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        <View style={styles.recurringRow}>
          <View style={styles.recurringCopy}>
            <Text style={styles.recurringTitle}>Criar regra recorrente</Text>
            <Text style={styles.recurringSubtitle}>Usa a mesma conta, categoria e valor todo mes.</Text>
          </View>
          <Switch value={recurring} onValueChange={setRecurring} />
        </View>

        {selectedFile ? (
          <View style={styles.fileCard}>
            <Text style={styles.fileTitle}>Arquivo selecionado</Text>
            <Text style={styles.fileMeta}>{selectedFile.name}</Text>
          </View>
        ) : null}

        {draftWarnings.length ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Avisos da captura</Text>
            {draftWarnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>
                - {warning}
              </Text>
            ))}
          </View>
        ) : null}

        {rawCaptureText ? (
          <View style={styles.captureCard}>
            <Text style={styles.captureTitle}>{captureMode === 'voice' ? 'Transcricao' : 'Texto lido'}</Text>
            <Text style={styles.captureText}>{rawCaptureText}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          {step === 'mode' ? renderModeStep() : renderReviewStep()}

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={handleClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            {step === 'review' ? (
              <Pressable
                style={[styles.primaryButton, createTransactionMutation.isPending && styles.disabledButton]}
                onPress={handleSave}
                disabled={createTransactionMutation.isPending}
              >
                {createTransactionMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Salvar</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    backdrop: {
      flex: 1,
    },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      gap: spacing.md,
    },
    contentBlock: {
      gap: spacing.md,
    },
    reviewContent: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    sheetTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    sheetSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    modeList: {
      gap: spacing.md,
    },
    modeCard: {
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    modeTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    modeText: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    inlineActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    typeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    typeChip: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    typeChipExpense: {
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      borderColor: 'rgba(220, 38, 38, 0.24)',
    },
    typeChipIncome: {
      backgroundColor: 'rgba(22, 163, 74, 0.08)',
      borderColor: 'rgba(22, 163, 74, 0.24)',
    },
    typeChipText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    typeChipTextExpense: {
      color: colors.danger,
    },
    typeChipTextIncome: {
      color: colors.success,
    },
    input: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
    },
    notesInput: {
      minHeight: 88,
      paddingTop: spacing.md,
      textAlignVertical: 'top',
    },
    label: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    wrapRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    filterChipText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: colors.primary,
    },
    recurringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    recurringCopy: {
      flex: 1,
    },
    recurringTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    recurringSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    fileCard: {
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    fileTitle: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    fileMeta: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    warningCard: {
      gap: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.warningSoft,
      padding: spacing.md,
    },
    warningTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    warningText: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    captureCard: {
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    captureTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    captureText: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    backButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backButtonText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    secondaryButton: {
      minHeight: 48,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
    },
    secondaryButtonText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    primaryButton: {
      minHeight: 48,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.md,
    },
    modeCardActionButton: {
      flex: 0,
      width: '100%',
      marginTop: spacing.xs,
    },
    primaryButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '700',
    },
    recordingButton: {
      backgroundColor: colors.danger,
    },
    disabledButton: {
      opacity: 0.7,
    },
  });
