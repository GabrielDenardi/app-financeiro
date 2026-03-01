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
import * as DocumentPicker from 'expo-document-picker';

const { width } = Dimensions.get('window');

export default function ImportScreen({ navigation }: any) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Seleção de arquivo com tratamento de erro e tipagem
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFileName(result.assets[0].name);
      }
    } catch (err) {
      console.error("Erro ao selecionar arquivo:", err);
    }
  };

  // Simulação de upload antes de mostrar o modal de sucesso
  const handleImportAction = () => {
    if (!fileName) return;

    setLoading(true);
    
    // Simula um delay de processamento de 1.5 segundos
    setTimeout(() => {
      setLoading(false);
      setIsModalVisible(true);
    }, 1500);
  };

  const resetSelection = () => {
    setFileName(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Fiel ao Design */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation?.goBack()}
        >
          <ChevronLeft color="#1E293B" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Importar Dados</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Principal */}
        <View style={styles.mainCard}>
          <View style={styles.iconCircle}>
            <FileSpreadsheet color="#10B981" size={32} />
          </View>
          
          <Text style={styles.cardTitle}>Importar Transações</Text>
          <Text style={styles.cardSubtitle}>
            Envie um arquivo CSV ou Excel com suas transações
          </Text>

          {/* Área de Seleção */}
          <TouchableOpacity 
            style={[
              styles.dropzone, 
              fileName ? styles.dropzoneActive : styles.dropzoneInactive
            ]} 
            onPress={pickDocument}
            activeOpacity={0.7}
          >
            {fileName ? (
              <View style={styles.fileSelectedContainer}>
                <FileSpreadsheet color="#10B981" size={40} />
                <Text style={styles.fileNameText} numberOfLines={1}>{fileName}</Text>
                <TouchableOpacity onPress={resetSelection} style={styles.removeFile}>
                   <X size={16} color="#EF4444" />
                   <Text style={{color: '#EF4444', fontSize: 12, fontWeight: '600'}}>Remover</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Upload color="#94A3B8" size={40} />
                <Text style={styles.dropzoneText}>Clique para selecionar</Text>
                <Text style={styles.dropzoneSubtext}>CSV, XLS ou XLSX</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Botão de Ação Dinâmico */}
          <TouchableOpacity 
            style={[
              styles.importButton, 
              fileName ? styles.importButtonEnabled : styles.importButtonDisabled
            ]} 
            onPress={handleImportAction}
            disabled={!fileName || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.importButtonText}>
                {fileName ? "Confirmar Importação" : "Aguardando arquivo..."}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Card de Formato Esperado */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Formato esperado</Text>
          <Text style={styles.infoDescription}>
            O arquivo deve conter colunas com informações das transações:
          </Text>
          
          <View style={styles.list}>
            <ListItem label="description" desc="Descrição da transação" />
            <ListItem label="amount" desc="Valor (número)" />
            <ListItem label="type" desc="income ou expense" />
            <ListItem label="category" desc="Categoria" />
            <ListItem label="date" desc="Data (YYYY-MM-DD)" />
          </View>
        </View>
      </ScrollView>

      {/* Modal de Sucesso Estilizado */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconBadge}>
              <CheckCircle2 size={48} color="#FFF" />
            </View>
            <Text style={styles.modalTitle}>Concluído</Text>
            <Text style={styles.modalMessage}>
              Seu arquivo foi importado com sucesso para o sistema!
            </Text>
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={() => {
                setIsModalVisible(false);
                setFileName(null);
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Sub-componente para a lista
const ListItem = ({ label, desc }: any) => (
  <View style={styles.listItem}>
    <Text style={styles.bullet}>• </Text>
    <Text style={styles.listLabel}>{label} - </Text>
    <Text style={styles.listDesc}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  backButton: { padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  mainCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  cardSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  
  dropzone: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dropzoneInactive: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  dropzoneActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  dropzoneText: { fontSize: 15, fontWeight: '600', color: '#475569', marginTop: 12 },
  dropzoneSubtext: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  
  fileSelectedContainer: { alignItems: 'center', width: '100%', padding: 10 },
  fileNameText: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 10 },
  removeFile: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },

  // BOTÃO EVOLUÍDO
  importButton: {
    width: '100%',
    height: 58,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  importButtonDisabled: { backgroundColor: '#CBD5E1' },
  importButtonEnabled: { 
    backgroundColor: '#059669', // Verde mais fechado e profissional
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  importButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    elevation: 2,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  infoDescription: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  list: { gap: 12 },
  listItem: { flexDirection: 'row' },
  bullet: { color: '#1E293B', fontWeight: 'bold' },
  listLabel: { fontWeight: '700', color: '#475569' },
  listDesc: { color: '#64748B', flex: 1 },

  // MODAL PREMIUM
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 32,
    alignItems: 'center',
  },
  successIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
  modalMessage: { fontSize: 16, color: '#64748B', textAlign: 'center', marginVertical: 15, lineHeight: 24 },
  modalButton: {
    backgroundColor: '#1E293B',
    width: '100%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});