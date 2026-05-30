import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useImportBatches, useImportTransactionsMutation } from '../features/imports/hooks/useImports';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

export default function ImportScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const batchesQuery = useImportBatches(user?.id);
  const importMutation = useImportTransactionsMutation(user?.id);
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [summary, setSummary] = useState<{ accepted: number; duplicate: number; failed: number } | null>(null);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setAsset(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível selecionar o arquivo.');
    }
  };

  const doImport = async () => {
    if (!asset) {
      return;
    }

    try {
      const result = await importMutation.mutateAsync({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      const accepted = result.previewRows.filter((row) => row.status === 'accepted').length;
      const duplicate = result.previewRows.filter((row) => row.status === 'duplicate').length;
      const failed = result.previewRows.filter((row) => row.status === 'failed').length;

      setSummary({ accepted, duplicate, failed });
      setAsset(null);

      if (accepted === 0) {
        const message = failed > 0
          ? 'O arquivo contém dados inválidos ou está em um formato incorreto. Corrija a planilha e tente novamente.'
          : 'Nenhuma transação nova foi importada. Todas as linhas do arquivo já existem no sistema.';

        Alert.alert('Erro', message);
        return;
      }

      setDoneOpen(true);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error ?? '');
      const validationError = /date\/time field value out of range|invalid input syntax for type date|invalid input syntax for type timestamp/i.test(rawMessage);
      const message = validationError
        ? 'O arquivo contém datas inválidas. Corrija a planilha e tente novamente.'
        : rawMessage || 'O arquivo não pôde ser importado. Verifique se o formato está correto.';

      Alert.alert('Erro', message);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Importar Dados" onBackPress={() => navigation.goBack()} />

      <Card style={styles.card}>
        <View style={styles.icon}>
          <FileSpreadsheet color={colors.success} size={28} />
        </View>
        <Text style={styles.cardTitle}>Importar Transações</Text>
        <Text style={styles.cardSub}>
          Envie um arquivo CSV ou Excel com suas transações e o backend processa o lote real.
        </Text>

        <Pressable style={[styles.drop, asset ? styles.dropOn : styles.dropOff]} onPress={pickFile}>
          {asset ? (
            <View style={styles.center}>
              <FileSpreadsheet color={colors.success} size={30} />
              <Text style={styles.file} numberOfLines={1}>
                {asset.name}
              </Text>
              <Pressable style={styles.remove} onPress={() => setAsset(null)}>
                <X size={14} color={colors.danger} />
                <Text style={styles.removeText}>Remover</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Upload color={colors.textSecondary} size={30} />
              <Text style={styles.dropText}>Clique para selecionar</Text>
              <Text style={styles.dropSub}>CSV, XLS ou XLSX</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.primary, (!asset || importMutation.isPending) && styles.dim]}
          onPress={doImport}
          disabled={!asset || importMutation.isPending}
        >
          {importMutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>{asset ? 'Confirmar Importação' : 'Importar Transações'}</Text>
          )}
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Formato esperado</Text>
        <Text style={styles.desc}>O arquivo deve conter colunas com as informações das transações:</Text>
        <Text style={styles.item}>description - Descrição da transação</Text>
        <Text style={styles.item}>amount - Valor numérico</Text>
        <Text style={styles.item}>type - income ou expense</Text>
        <Text style={styles.item}>category - Categoria</Text>
        <Text style={styles.item}>payment_method - Método de pagamento</Text>
        <Text style={styles.item}>date - Data em YYYY-MM-DD</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Últimos lotes</Text>
        {batchesQuery.isLoading ? <ActivityIndicator color={colors.primaryLight} /> : null}
        {batchesQuery.isError ? <Text style={styles.desc}>Não foi possível carregar o histórico.</Text> : null}
        {!batchesQuery.isLoading && !batchesQuery.isError && !(batchesQuery.data?.length) ? (
          <Text style={styles.desc}>Nenhum arquivo importado ainda.</Text>
        ) : null}
        {(batchesQuery.data ?? []).map((batch) => (
          <View key={batch.id} style={styles.batch}>
            <View style={styles.flex}>
              <Text style={styles.batchFile}>{batch.fileName}</Text>
              <Text style={styles.batchMeta}>
                {batch.importedCount} importadas, {batch.duplicateCount} duplicadas, {batch.failedCount} falhas
              </Text>
            </View>
            <Text style={styles.batchStatus}>{batch.status}</Text>
          </View>
        ))}
      </Card>

      <Modal visible={doneOpen} transparent animationType="fade" onRequestClose={() => setDoneOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.ok}>
              <CheckCircle2 size={40} color={colors.white} />
            </View>
            <Text style={styles.modalTitle}>Concluído</Text>
            <Text style={styles.modalText}>
              {summary?.accepted ?? 0} aceitas, {summary?.duplicate ?? 0} duplicadas e {summary?.failed ?? 0} com falha.
            </Text>
            <Pressable style={styles.primary} onPress={() => setDoneOpen(false)}>
              <Text style={styles.primaryText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    cardTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    cardSub: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 19,
      textAlign: 'center',
    },
    drop: {
      minHeight: 150,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    dropOff: {
      borderColor: colors.border,
      backgroundColor: colors.mutedSurface,
    },
    dropOn: {
      borderColor: colors.success,
      backgroundColor: colors.successSoft,
    },
    center: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    dropText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    dropSub: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    file: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    remove: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    removeText: {
      ...typography.caption,
      color: colors.danger,
      fontWeight: '700',
    },
    primary: {
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dim: {
      opacity: 0.6,
    },
    primaryText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    section: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    desc: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    item: {
      ...typography.body,
      color: colors.textSecondary,
    },
    batch: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    flex: {
      flex: 1,
    },
    batchFile: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    batchMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 17,
    },
    batchStatus: {
      ...typography.caption,
      color: colors.success,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modal: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      gap: spacing.sm,
    },
    ok: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    modalTitle: {
      ...typography.h1,
      color: colors.textPrimary,
    },
    modalText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
  });
