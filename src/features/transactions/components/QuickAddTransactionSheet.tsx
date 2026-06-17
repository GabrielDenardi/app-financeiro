import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { BottomSheet } from "../../../components/BottomSheet";
import { Button } from "../../../components/Button";
import { Chip } from "../../../components/Chip";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../../../theme";
import type { AccountBalanceSnapshot } from "../../accounts/types";
import { useCreateTransactionMutation } from "../hooks/useTransactions";
import {
  deleteTransactionAttachment,
  parseTransactionFromOcr,
  parseTransactionFromVoice,
  pickDocumentFile,
  pickImageFromCamera,
  pickImageFromLibrary,
  uploadTransactionAttachment,
  type LocalCaptureFile,
} from "../services/transactionCaptureService";
import type {
  CapturedTransactionDraft,
  CreateTransactionInput,
  EntryType,
  FinanceCategory,
  PaymentMethod,
} from "../types";

type QuickAddTransactionSheetProps = {
  visible: boolean;
  currentUserId?: string | null;
  accounts: AccountBalanceSnapshot[];
  categories: FinanceCategory[];
  primaryAccountId?: string | null;
  allowVoiceCapture?: boolean;
  onClose: () => void;
};

type CaptureMode = "manual" | "voice" | "ocr";
type SheetStep = "mode" | "review";

const PAYMENT_METHODS: PaymentMethod[] = [
  "Pix",
  "Transferencia",
  "Dinheiro",
  "Cartao de debito",
  "Cartao de credito",
  "Boleto",
];

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateDisplay(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
}

function maskDateDisplay(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join("/");
}

function parseDateDisplay(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(year, month - 1, day);
  const isSameDate =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;

  if (!isSameDate) return null;

  return `${yearText}-${monthText}-${dayText}`;
}

function formatCentsToDisplay(digits: string): string {
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const int = padded.slice(0, -2).replace(/^0+/, "") || "0";
  const dec = padded.slice(-2);
  return `${int},${dec}`;
}

function amountToCents(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    return "";
  return String(Math.round(value * 100));
}

function fallbackTitleForMode(mode: CaptureMode) {
  return mode === "voice"
    ? "Lançamento por voz"
    : mode === "ocr"
      ? "Lançamento por OCR"
      : "Lançamento rápido";
}

function formatPaymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    Pix: "Pix",
    Transferencia: "Transferência",
    Dinheiro: "Dinheiro",
    "Cartao de debito": "Cartão de débito",
    "Cartao de credito": "Cartão de crédito",
    Boleto: "Boleto",
  };

  return labels[method];
}

function toOccurredAt(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function categoryMatchesEntryType(
  category: FinanceCategory,
  entryType: EntryType,
) {
  return category.kind === "both" || category.kind === entryType;
}

export function QuickAddTransactionSheet({
  visible,
  currentUserId,
  accounts,
  categories,
  primaryAccountId,
  allowVoiceCapture = false,
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

  const [step, setStep] = useState<SheetStep>("mode");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("manual");
  const [type, setType] = useState<EntryType>("expense");
  const [title, setTitle] = useState("");
  const [amountDigits, setAmountDigits] = useState("");
  const [accountId, setAccountId] = useState(primaryAccountId ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Pix");
  const [notes, setNotes] = useState("");
  const [occurredOnDisplay, setOccurredOnDisplay] = useState(
    formatDateDisplay(formatDateInput(new Date())),
  );
  const [recurring, setRecurring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LocalCaptureFile | null>(
    null,
  );
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);
  const [rawCaptureText, setRawCaptureText] = useState("");
  const [captureConfidence, setCaptureConfidence] = useState<number | null>(
    null,
  );
  const [merchantOrIssuer, setMerchantOrIssuer] = useState<string | null>(null);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseLabel, setParseLabel] = useState("");

  const getCategoriesForType = useCallback(
    (entryType: EntryType) =>
      categories.filter((category) =>
        categoryMatchesEntryType(category, entryType),
      ),
    [categories],
  );

  const resolveCategoryIdForType = useCallback(
    (entryType: EntryType, currentCategoryId: string | null) => {
      const categoryOptions = getCategoriesForType(entryType);

      if (
        currentCategoryId &&
        categoryOptions.some((category) => category.id === currentCategoryId)
      ) {
        return currentCategoryId;
      }

      return categoryOptions[0]?.id ?? null;
    },
    [getCategoriesForType],
  );

  const filteredCategories = useMemo(
    () => getCategoriesForType(type),
    [getCategoriesForType, type],
  );

  const resetState = () => {
    setStep("mode");
    setCaptureMode("manual");
    setType("expense");
    setTitle("");
    setAmountDigits("");
    setAccountId(
      primaryAccountId ??
        accounts.find((account) => account.isActive)?.id ??
        accounts[0]?.id ??
        "",
    );
    setCategoryId(null);
    setPaymentMethod("Pix");
    setNotes("");
    const today = formatDateInput(new Date());
    setOccurredOnDisplay(formatDateDisplay(today));
    setRecurring(false);
    setSelectedFile(null);
    setDraftWarnings([]);
    setRawCaptureText("");
    setCaptureConfidence(null);
    setMerchantOrIssuer(null);
    setDocumentNumber(null);
    setIsParsing(false);
    setParseLabel("");
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

  const handleOccurredOnChange = (value: string) => {
    const nextDisplay = maskDateDisplay(value);

    setOccurredOnDisplay(nextDisplay);
  };

  const applyDraft = (
    draft: CapturedTransactionDraft,
    mode: Exclude<CaptureMode, "manual">,
  ) => {
    const nextType = draft.type ?? "expense";
    const matchedCategory = draft.suggestedCategoryCode
      ? categories.find(
          (category) =>
            category.code === draft.suggestedCategoryCode &&
            categoryMatchesEntryType(category, nextType),
        )
      : null;

    const nextDate = draft.occurredAt
      ? formatDateInput(new Date(draft.occurredAt))
      : formatDateInput(new Date());
    const nextWarnings =
      draft.warnings.length > 0
        ? draft.warnings
        : draft.occurredAt
          ? []
          : [
              "A data não foi encontrada com segurança. Revise antes de salvar.",
            ];

    setCaptureMode(mode);
    setType(nextType);
    setTitle(
      draft.title?.trim() ||
        draft.merchantOrIssuer?.trim() ||
        fallbackTitleForMode(mode),
    );
    setAmountDigits(amountToCents(draft.amount));
    setPaymentMethod(
      (PAYMENT_METHODS.includes(draft.paymentMethod as PaymentMethod)
        ? draft.paymentMethod
        : "Pix") as PaymentMethod,
    );
    setOccurredOnDisplay(formatDateDisplay(nextDate));
    setCategoryId(
      resolveCategoryIdForType(nextType, matchedCategory?.id ?? null),
    );
    setNotes(draft.notes ?? "");
    setDraftWarnings(nextWarnings);
    setRawCaptureText(draft.rawTranscriptOrOcrText ?? "");
    setCaptureConfidence(draft.confidence ?? null);
    setMerchantOrIssuer(draft.merchantOrIssuer ?? null);
    setDocumentNumber(draft.documentNumber ?? null);
    setStep("review");
  };

  const handleParseFile = async (
    mode: Exclude<CaptureMode, "manual">,
    file: LocalCaptureFile,
  ) => {
    if (mode === "voice" && !allowVoiceCapture) {
      Alert.alert(
        "Plano necessário",
        "Cadastro por voz não está disponível no seu plano atual.",
      );
      return;
    }

    setSelectedFile(file);
    setCaptureMode(mode);
    setIsParsing(true);
    setParseLabel(
      mode === "voice" ? "Analisando áudio..." : "Lendo documento...",
    );

    try {
      const draft =
        mode === "voice"
          ? await parseTransactionFromVoice(file)
          : await parseTransactionFromOcr(file);
      applyDraft(draft, mode);
    } catch (error) {
      Alert.alert(
        "Captura",
        error instanceof Error
          ? error.message
          : "Não foi possível interpretar o arquivo.",
      );
    } finally {
      setIsParsing(false);
      setParseLabel("");
    }
  };

  const handleManualStart = () => {
    setCaptureMode("manual");
    setStep("review");
  };

  const handlePickFromCamera = async () => {
    try {
      const file = await pickImageFromCamera();
      if (file) {
        await handleParseFile("ocr", file);
      }
    } catch (error) {
      Alert.alert(
        "OCR",
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a câmera.",
      );
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const file = await pickImageFromLibrary();
      if (file) {
        await handleParseFile("ocr", file);
      }
    } catch (error) {
      Alert.alert(
        "OCR",
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a galeria.",
      );
    }
  };

  const handlePickDocument = async () => {
    try {
      const file = await pickDocumentFile();
      if (file) {
        await handleParseFile("ocr", file);
      }
    } catch (error) {
      Alert.alert(
        "OCR",
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o documento.",
      );
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
    if (!allowVoiceCapture) {
      Alert.alert(
        "Plano necessário",
        "Cadastro por voz não está disponível no seu plano atual.",
      );
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Voz", "Permissão de microfone negada.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setCaptureMode("voice");
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
      Alert.alert(
        "Voz",
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a gravação.",
      );
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
        throw new Error("Nenhum áudio foi gerado.");
      }

      const file: LocalCaptureFile = {
        uri: recorder.uri,
        name: `voice-${Date.now()}${Platform.OS === "web" ? ".webm" : ".m4a"}`,
        mimeType: Platform.OS === "web" ? "audio/webm" : "audio/mp4",
        size: 0,
      };

      await handleParseFile("voice", file);
    } catch (error) {
      Alert.alert(
        "Voz",
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a gravação.",
      );
    } finally {
      setRecorderRevision((current) => current + 1);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) {
      Alert.alert("Transação", "Usuário não autenticado.");
      return;
    }

    if (!accountId) {
      Alert.alert("Transação", "Selecione uma conta.");
      return;
    }

    const parsedAmount = amountDigits ? Number(amountDigits) / 100 : 0;
    if (parsedAmount <= 0) {
      Alert.alert("Transação", "Informe um valor válido.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Transação", "Informe uma descrição.");
      return;
    }

    const parsedOccurredOn = parseDateDisplay(occurredOnDisplay);
    if (!parsedOccurredOn) {
      Alert.alert("Transação", "Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }

    let uploadedAttachment: Awaited<
      ReturnType<typeof uploadTransactionAttachment>
    > | null = null;

    try {
      if (captureMode !== "manual" && selectedFile) {
        uploadedAttachment = await uploadTransactionAttachment({
          file: selectedFile,
          attachmentKind:
            captureMode === "voice" ? "audio_note" : "ocr_document",
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
        occurredAt: toOccurredAt(parsedOccurredOn),
        notes: notes.trim(),
        isRecurring: recurring,
        sourceType: captureMode,
        attachmentId: uploadedAttachment?.id ?? null,
        captureMetadata:
          captureMode === "manual"
            ? undefined
            : {
                provider: "openai",
                confidence: captureConfidence,
                warnings: draftWarnings,
                transcript:
                  captureMode === "voice" ? rawCaptureText : undefined,
                ocrText: captureMode === "ocr" ? rawCaptureText : undefined,
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

      Alert.alert(
        "Transação",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a transação.",
      );
    }
  };

  const renderModeStep = () => (
    <View style={styles.contentBlock}>
      <Text style={styles.sheetTitle}>Como você quer preencher?</Text>
      <Text style={styles.sheetSubtitle}>
        Escolha o modo de captura. A revisão final acontece antes de salvar.
      </Text>

      <View style={styles.modeList}>
        <Pressable style={styles.modeCard} onPress={handleManualStart}>
          <Text style={styles.modeTitle}>Manual</Text>
          <Text style={styles.modeText}>
            Preenchimento completo no formulário.
          </Text>
        </Pressable>

        {allowVoiceCapture ? (
          <View style={styles.modeCard}>
            <Text style={styles.modeTitle}>Por voz</Text>
            <Text style={styles.modeText}>
              Grave um resumo curto e deixe a IA montar o rascunho.
            </Text>
            <Button
              label={
                recorderState.isRecording ? "Parar e analisar" : "Gravar áudio"
              }
              variant={recorderState.isRecording ? "danger" : "primary"}
              fullWidth
              disabled={isParsing}
              style={styles.modeCardActionButton}
              onPress={
                recorderState.isRecording
                  ? handleStopRecording
                  : handleStartRecording
              }
            />
          </View>
        ) : null}

        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>Leitura OCR</Text>
          <Text style={styles.modeText}>
            Use câmera, galeria ou PDF para ler uma NF ou notinha.
          </Text>
          <View style={styles.inlineActions}>
            <Button
              label="Câmera"
              variant="secondary"
              size="sm"
              disabled={isParsing}
              onPress={handlePickFromCamera}
            />
            <Button
              label="Galeria"
              variant="secondary"
              size="sm"
              disabled={isParsing}
              onPress={handlePickFromLibrary}
            />
            <Button
              label="PDF"
              variant="secondary"
              size="sm"
              disabled={isParsing}
              onPress={handlePickDocument}
            />
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
    <View style={styles.contentBlock}>
      <View style={styles.rowBetween}>
        <View style={styles.rowBetweenCopy}>
          <Text style={styles.sheetTitle}>Revisar lançamento</Text>
          <Text style={styles.sheetSubtitle}>
            {captureMode === "manual"
              ? "Confira os dados antes de salvar."
              : "O rascunho foi preenchido automaticamente e pode ser ajustado."}
          </Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => setStep("mode")}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </View>

      <View style={styles.typeRow}>
        {(["expense", "income"] as EntryType[]).map((entryType) => (
          <Chip
            key={entryType}
            label={entryType === "expense" ? "Despesa" : "Receita"}
            selected={entryType === type}
            activeColor={
              entryType === type
                ? entryType === "expense"
                  ? colors.danger
                  : colors.success
                : undefined
            }
            onPress={() => handleTypeChange(entryType)}
            style={styles.typeChip}
          />
        ))}
      </View>

      <TextInput
        placeholder="Descrição"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        placeholder="0,00"
        value={formatCentsToDisplay(amountDigits)}
        onChangeText={(text) =>
          setAmountDigits(text.replace(/\D/g, "").replace(/^0+/, ""))
        }
        keyboardType="numeric"
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        placeholder="DD/MM/AAAA"
        value={occurredOnDisplay}
        onChangeText={handleOccurredOnChange}
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        maxLength={10}
      />

      <Text style={styles.label}>Conta</Text>
      <View style={styles.wrapRow}>
        {accounts.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            selected={accountId === account.id}
            onPress={() => setAccountId(account.id)}
          />
        ))}
      </View>

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.wrapRow}>
        {filteredCategories.map((category) => (
          <Chip
            key={category.id}
            label={category.label}
            selected={categoryId === category.id}
            onPress={() => setCategoryId(category.id)}
          />
        ))}
      </View>

      <Text style={styles.label}>Método</Text>
      <View style={styles.wrapRow}>
        {PAYMENT_METHODS.map((method) => (
          <Chip
            key={method}
            label={formatPaymentMethodLabel(method)}
            selected={paymentMethod === method}
            onPress={() => setPaymentMethod(method)}
          />
        ))}
      </View>

      <TextInput
        placeholder="Observações"
        value={notes}
        onChangeText={setNotes}
        style={[styles.input, styles.notesInput]}
        placeholderTextColor={colors.textSecondary}
        multiline
      />

      <View style={styles.recurringRow}>
        <View style={styles.recurringCopy}>
          <Text style={styles.recurringTitle}>Criar regra recorrente</Text>
          <Text style={styles.recurringSubtitle}>
            Usa a mesma conta, categoria e valor todo mês.
          </Text>
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
          <Text style={styles.captureTitle}>
            {captureMode === "voice" ? "Transcrição" : "Texto lido"}
          </Text>
          <Text style={styles.captureText}>{rawCaptureText}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      footer={(close) => (
        <>
          <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
          {step === "review" ? (
            <Button
              label="Salvar"
              fullWidth
              onPress={handleSave}
              loading={createTransactionMutation.isPending}
            />
          ) : null}
        </>
      )}
    >
      {step === "mode" ? renderModeStep() : renderReviewStep()}
    </BottomSheet>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    contentBlock: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    rowBetweenCopy: {
      flex: 1,
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
      fontWeight: "700",
    },
    modeText: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    loadingText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    inlineActions: {
      flexDirection: "row",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    typeRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    typeChip: {
      flex: 1,
      justifyContent: "center",
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
      textAlignVertical: "top",
    },
    label: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    wrapRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    recurringRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    recurringCopy: {
      flex: 1,
    },
    recurringTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
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
      fontWeight: "700",
    },
    fileMeta: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
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
      fontWeight: "700",
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
      fontWeight: "700",
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
      fontWeight: "700",
    },
    modeCardActionButton: {
      marginTop: spacing.xs,
    },
  });
