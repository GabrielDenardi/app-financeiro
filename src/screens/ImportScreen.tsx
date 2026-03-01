import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, FileSpreadsheet, Upload, CheckCircle2, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker'; //

const { width } = Dimensions.get('window');

export default function ImportScreen({ navigation }: any) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
      });

      // Correção do erro de tipagem assets[0]
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFileName(result.assets[0].name);
      }
    } catch (err) {
      console.error("Erro ao selecionar arquivo:", err);
    }
  };

  const handleImportAction = () => {
    if (!fileName) return;
    setLoading(true);
    
    // Simula processamento antes do modal
    setTimeout(() => {
      setLoading(false);
      setIsModalVisible(true);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header idêntico ao design */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <ChevronLeft color="#1E293B" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Importar Dados</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mainCard}>
          <View style={styles.iconCircle}>
            <FileSpreadsheet color="#10B981" size={32} />
          </View>
          
          <Text style={styles.cardTitle}>Importar Transações</Text>
          <Text style={styles.cardSubtitle}>Envie um arquivo CSV ou Excel com suas transações</Text>

          {/* Área de Seleção Dinâmica */}
          <TouchableOpacity 
            style={[styles.dropzone, fileName ? styles.dropzoneActive : styles.dropzoneInactive]} 
            onPress={pickDocument}
          >
            {fileName ? (
              <View style={styles.selectedContainer}>
                <FileSpreadsheet color="#10B981" size={32} />
                <Text style={styles.fileNameText} numberOfLines={1}>{fileName}</Text>
                <TouchableOpacity onPress={() => setFileName(null)} style={styles.removeBtn}>
                  <X size={14} color="#EF4444" />
                  <Text style={styles.removeText}>Remover</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Upload color="#94A3B8" size={32} />
                <Text style={styles.dropzoneText}>Clique para selecionar</Text>
                <Text style={styles.dropzoneSubtext}>CSV, XLS ou XLSX</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Botão que "acende" ao importar */}
          <TouchableOpacity 
            style={[styles.importBtn, fileName ? styles.btnActive : styles.btnDisabled]} 
            onPress={handleImportAction}
            disabled={!fileName || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.importBtnText}>
                {fileName ? "Confirmar Importação" : "Importar Transações"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Seção de Formato Esperado */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Formato esperado</Text>
          <Text style={styles.infoDesc}>O arquivo deve conter colunas com informações das transações:</Text>
          
          <View style={styles.list}>
            <Text style={styles.listItem}>• <Text style={styles.bold}>description</Text> - Descrição da transação</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>amount</Text> - Valor (número)</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>type</Text> - income ou expense</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>category</Text> - Categoria</Text>
            <Text style={styles.listItem}>• <Text style={styles.bold}>date</Text> - Data (YYYY-MM-DD)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Sucesso Estilizado */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBox}>
              <CheckCircle2 size={40} color="#FFF" />
            </View>
            <Text style={styles.modalTitle}>Concluído</Text>
            <Text style={styles.modalMsg}>Seu arquivo foi importado com sucesso para o sistema!</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsModalVisible(false)}>
              <Text style={styles.modalCloseText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  backButton: { padding: 5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  mainCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, marginBottom: 20 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  cardSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 5, marginBottom: 20 },
  dropzone: { width: '100%', height: 140, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  dropzoneInactive: { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  dropzoneActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  dropzoneText: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 10 },
  dropzoneSubtext: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  selectedContainer: { alignItems: 'center' },
  fileNameText: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 5 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  removeText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  importBtn: { width: '100%', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { backgroundColor: '#94A3B880' },
  btnActive: { backgroundColor: '#10B981', elevation: 4, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 5 },
  importBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 24 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  infoDesc: { fontSize: 13, color: '#64748B', marginBottom: 15 },
  list: { gap: 8 },
  listItem: { fontSize: 13, color: '#64748B' },
  bold: { fontWeight: '700', color: '#475569' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.8, backgroundColor: '#FFF', borderRadius: 25, padding: 30, alignItems: 'center' },
  modalIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  modalMsg: { fontSize: 14, color: '#64748B', textAlign: 'center', marginVertical: 12, lineHeight: 20 },
  modalCloseBtn: { backgroundColor: '#1E293B', width: '100%', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  modalCloseText: { color: '#FFF', fontWeight: '700' },
});