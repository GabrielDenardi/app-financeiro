import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, ChevronLeft, FileSpreadsheet, Upload, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useImportBatches, useImportTransactionsMutation } from '../features/imports/hooks/useImports';

export default function ImportScreen({ navigation }: any) {
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
      if (!result.canceled) setAsset(result.assets[0]);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel selecionar o arquivo.');
    }
  };

  const doImport = async () => {
    if (!asset) return;
    try {
      const result = await importMutation.mutateAsync({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      setSummary({
        accepted: result.previewRows.filter((row) => row.status === 'accepted').length,
        duplicate: result.previewRows.filter((row) => row.status === 'duplicate').length,
        failed: result.previewRows.filter((row) => row.status === 'failed').length,
      });
      setDoneOpen(true);
      setAsset(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo.');
    }
  };

  return (
    <SafeAreaView style={s.bg}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.head}><Pressable onPress={() => navigation.goBack()} style={s.back}><ChevronLeft color="#1e293b" size={24} /></Pressable><Text style={s.title}>Importar Dados</Text></View>

        <View style={s.card}>
          <View style={s.icon}><FileSpreadsheet color="#10b981" size={30} /></View>
          <Text style={s.cardTitle}>Importar Transacoes</Text>
          <Text style={s.cardSub}>Envie um arquivo CSV ou Excel com suas transacoes e o backend processa o lote real.</Text>

          <Pressable style={[s.drop, asset ? s.dropOn : s.dropOff]} onPress={pickFile}>
            {asset ? (
              <View style={s.center}>
                <FileSpreadsheet color="#10b981" size={30} />
                <Text style={s.file} numberOfLines={1}>{asset.name}</Text>
                <Pressable style={s.remove} onPress={() => setAsset(null)}><X size={14} color="#ef4444" /><Text style={s.removeText}>Remover</Text></Pressable>
              </View>
            ) : (
              <View style={s.center}>
                <Upload color="#94a3b8" size={30} />
                <Text style={s.dropText}>Clique para selecionar</Text>
                <Text style={s.dropSub}>CSV, XLS ou XLSX</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={[s.primary, (!asset || importMutation.isPending) && s.dim]} onPress={doImport} disabled={!asset || importMutation.isPending}>
            {importMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{asset ? 'Confirmar Importacao' : 'Importar Transacoes'}</Text>}
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.section}>Formato esperado</Text>
          <Text style={s.desc}>O arquivo deve conter colunas com as informacoes das transacoes:</Text>
          <Text style={s.item}>• description - Descricao da transacao</Text>
          <Text style={s.item}>• amount - Valor numerico</Text>
          <Text style={s.item}>• type - income ou expense</Text>
          <Text style={s.item}>• category - Categoria</Text>
          <Text style={s.item}>• payment_method - Metodo de pagamento</Text>
          <Text style={s.item}>• date - Data em YYYY-MM-DD</Text>
        </View>

        <View style={s.card}>
          <Text style={s.section}>Ultimos lotes</Text>
          {batchesQuery.isLoading ? <ActivityIndicator color="#10b981" /> : null}
          {batchesQuery.isError ? <Text style={s.desc}>Nao foi possivel carregar o historico.</Text> : null}
          {!batchesQuery.isLoading && !batchesQuery.isError && !(batchesQuery.data?.length) ? <Text style={s.desc}>Nenhum arquivo importado ainda.</Text> : null}
          {(batchesQuery.data ?? []).map((batch) => <View key={batch.id} style={s.batch}><View style={s.flex}><Text style={s.batchFile}>{batch.fileName}</Text><Text style={s.batchMeta}>{batch.importedCount} importadas • {batch.duplicateCount} duplicadas • {batch.failedCount} falhas</Text></View><Text style={s.batchStatus}>{batch.status}</Text></View>)}
        </View>
      </ScrollView>

      <Modal visible={doneOpen} transparent animationType="fade" onRequestClose={() => setDoneOpen(false)}>
        <View style={s.overlay}><View style={s.modal}><View style={s.ok}><CheckCircle2 size={40} color="#fff" /></View><Text style={s.modalTitle}>Concluido</Text><Text style={s.modalText}>{summary?.accepted ?? 0} aceitas, {summary?.duplicate ?? 0} duplicadas e {summary?.failed ?? 0} com falha.</Text><Pressable style={s.primary} onPress={() => setDoneOpen(false)}><Text style={s.primaryText}>OK</Text></Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' }, content: { paddingHorizontal: 20, paddingBottom: 30 }, head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20 }, back: { padding: 4 }, title: { fontSize: 18, fontWeight: '800', color: '#1e293b' }, card: { backgroundColor: '#fff', borderRadius: 22, padding: 24, marginBottom: 20 }, icon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }, cardTitle: { textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#1e293b' }, cardSub: { textAlign: 'center', fontSize: 13, color: '#64748b', lineHeight: 19, marginTop: 6, marginBottom: 20 }, drop: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', minHeight: 150, justifyContent: 'center', alignItems: 'center', marginBottom: 20, padding: 18 }, dropOff: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }, dropOn: { borderColor: '#10b981', backgroundColor: '#f0fdf4' }, center: { alignItems: 'center' }, dropText: { fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 10 }, dropSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 }, file: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginTop: 8 }, remove: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }, removeText: { fontSize: 12, fontWeight: '700', color: '#ef4444' }, primary: { minHeight: 50, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }, dim: { opacity: 0.6 }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 }, section: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 10 }, desc: { fontSize: 13, color: '#64748b', lineHeight: 19, marginBottom: 10 }, item: { fontSize: 13, color: '#64748b', marginBottom: 8 }, batch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }, flex: { flex: 1 }, batchFile: { fontSize: 13, fontWeight: '800', color: '#1e293b' }, batchMeta: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 17 }, batchStatus: { fontSize: 11, fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center' }, ok: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' }, modalText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginVertical: 12 },
});
