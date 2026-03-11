import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useImportBatches, useImportTransactionsMutation } from '../features/imports/hooks/useImports';
import { colors, radius, spacing, typography } from '../theme';

export default function ImportScreen({ navigation }: any) {
  const currentUser = useAuthenticatedUser();
  const importBatchesQuery = useImportBatches(currentUser?.id);
  const importMutation = useImportTransactionsMutation(currentUser?.id);
  const [selectedAsset, setSelectedAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<{ accepted: number; duplicate: number; failed: number } | null>(null);

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      setSelectedAsset(result.assets[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedAsset) {
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        uri: selectedAsset.uri,
        name: selectedAsset.name,
        mimeType: selectedAsset.mimeType,
      });

      const accepted = result.previewRows.filter((row) => row.status === 'accepted').length;
      const duplicate = result.previewRows.filter((row) => row.status === 'duplicate').length;
      const failed = result.previewRows.filter((row) => row.status === 'failed').length;

      setLastImportSummary({ accepted, duplicate, failed });
      setResultVisible(true);
      setSelectedAsset(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Importar dados</Text>
            <Text style={styles.subtitle}>CSV e XLSX com batch, deduplicacao e auditoria.</Text>
          </View>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.iconCircle}>
            <FileSpreadsheet color={colors.success} size={28} />
          </View>
          <Text style={styles.cardTitle}>Importar transacoes</Text>
          <Text style={styles.cardSubtitle}>
            Campos esperados: description, amount, type, category, payment_method e date.
          </Text>

          <Pressable style={styles.dropzone} onPress={handlePickDocument}>
            {selectedAsset ? (
              <View style={styles.selectedFile}>
                <Text style={styles.fileName}>{selectedAsset.name}</Text>
                <Pressable onPress={() => setSelectedAsset(null)} style={styles.removeButton}>
                  <X size={14} color={colors.danger} />
                  <Text style={styles.removeButtonText}>Remover</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Upload color={colors.textSecondary} size={28} />
                <Text style={styles.dropzoneText}>Selecionar arquivo</Text>
                <Text style={styles.dropzoneHint}>CSV, XLS ou XLSX</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.importButton, (!selectedAsset || importMutation.isPending) && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={!selectedAsset || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.importButtonText}>Confirmar importacao</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Ultimos lotes</Text>
          {importBatchesQuery.data?.length ? (
            importBatchesQuery.data.map((batch) => (
              <View key={batch.id} style={styles.batchRow}>
                <View style={styles.batchLeft}>
                  <Text style={styles.batchFile}>{batch.fileName}</Text>
                  <Text style={styles.batchMeta}>
                    {batch.importedCount} importadas • {batch.duplicateCount} duplicadas • {batch.failedCount} falhas
                  </Text>
                </View>
                <Text style={styles.batchStatus}>{batch.status}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhum arquivo importado ainda.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <CheckCircle2 size={36} color={colors.white} />
            </View>
            <Text style={styles.modalTitle}>Importacao concluida</Text>
            <Text style={styles.modalText}>
              {lastImportSummary?.accepted ?? 0} aceitas, {lastImportSummary?.duplicate ?? 0} duplicadas e{' '}
              {lastImportSummary?.failed ?? 0} com falha.
            </Text>
            <Pressable style={styles.importButton} onPress={() => setResultVisible(false)}>
              <Text style={styles.importButtonText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dropzone: {
    width: '100%',
    minHeight: 160,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  selectedFile: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  removeButtonText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  dropzoneText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  dropzoneHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  importButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  historyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  batchLeft: {
    flex: 1,
  },
  batchFile: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  batchMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  batchStatus: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
