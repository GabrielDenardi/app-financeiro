import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BalanceCard } from '../components/BalanceCard';
import { BOTTOM_TAB_BAR_HEIGHT, BottomTabBarMock } from '../components/BottomTabBarMock';
import { Card } from '../components/Card';
import { FAB_SIZE, FloatingActionButton } from '../components/FloatingActionButton';
import { MonthlyBarChart } from '../components/MonthlyBarChart';
import { SectionHeader } from '../components/SectionHeader';
import { SummaryStatCard } from '../components/SummaryStatCard';
import { TransactionListItem } from '../components/TransactionListItem';
import { homeDashboardMock } from '../data/homeMock';
import { colors, radius, spacing, typography } from '../theme';

const MODAL_SHEET_CLOSED_TRANSLATE_Y = 420;
const MODAL_DRAG_DISMISS_DISTANCE = 160;
const MODAL_DRAG_DISMISS_VELOCITY = 1.45;
const MODAL_DRAG_MIN_DISTANCE_FOR_VELOCITY_CLOSE = 56;
const MODAL_DRAG_RESISTANCE_START = 72;
const MODAL_DRAG_RESISTANCE_FACTOR = 0.62;
const QUICK_ADD_CATEGORY_OPTIONS = [
  'Alimentacao',
  'Transporte',
  'Moradia',
  'Saude',
  'Lazer',
  'Salario',
  'Freelance',
] as const;

function applyModalDragResistance(offset: number): number {
  if (offset <= 0) {
    return 0;
  }

  if (offset <= MODAL_DRAG_RESISTANCE_START) {
    return offset;
  }

  const extraOffset = offset - MODAL_DRAG_RESISTANCE_START;
  return MODAL_DRAG_RESISTANCE_START + extraOffset * MODAL_DRAG_RESISTANCE_FACTOR;
}

function formatQuickAddDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function HomeScreen() {
  const data = homeDashboardMock;
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);
  const [isQuickAddModalVisible, setIsQuickAddModalVisible] = useState(false);
  const [isQuickAddModalMounted, setIsQuickAddModalMounted] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'income' | 'expense'>('expense');
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState<string | null>(null);
  const [quickAddDate, setQuickAddDate] = useState(new Date());
  const [isQuickAddCategoryPickerOpen, setIsQuickAddCategoryPickerOpen] = useState(false);
  const [isQuickAddDatePickerOpen, setIsQuickAddDatePickerOpen] = useState(false);
  const [isQuickAddNativeDatePickerVisible, setIsQuickAddNativeDatePickerVisible] =
    useState(false);
  const [isTransactionsModalVisible, setIsTransactionsModalVisible] = useState(false);
  const [isTransactionsModalMounted, setIsTransactionsModalMounted] = useState(false);
  const modalSheetTranslateY = useRef(
    new Animated.Value(MODAL_SHEET_CLOSED_TRANSLATE_Y)
  ).current;
  const modalDragStartY = useRef(0);
  const quickAddSheetTranslateY = useRef(
    new Animated.Value(MODAL_SHEET_CLOSED_TRANSLATE_Y)
  ).current;
  const quickAddModalDragStartY = useRef(0);

  const handleFabPress = () => {
    quickAddSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
    setIsQuickAddModalMounted(true);
    setIsQuickAddModalVisible(true);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
    console.log('[Home] add-transaction');
  };

  const handleSeeAllPress = () => {
    modalSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
    setIsTransactionsModalMounted(true);
    setIsTransactionsModalVisible(true);
    console.log('[Home] see-all-transactions');
  };

  const toggleAmountsVisibility = () => {
    setIsAmountsVisible((current) => !current);
  };

  const handleCloseTransactionsModal = () => {
    setIsTransactionsModalVisible(false);
  };

  const handleCloseQuickAddModal = () => {
    setIsQuickAddModalVisible(false);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleConfirmQuickAdd = () => {
    console.log(
      `[Home] quick-add type=${quickAddType} amount=${quickAddAmount || '0'} category=${quickAddCategory ?? 'none'
      } date=${quickAddDate.toISOString()}`
    );
    setIsQuickAddModalVisible(false);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleQuickAddAmountChange = (value: string) => {
    const normalized = value.replace(',', '.');
    const cleaned = normalized.replace(/[^0-9.]/g, '');

    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return;
    }

    const integerPart = parts[0] ?? '';
    const decimalPart = parts[1] ?? '';
    const nextValue =
      parts.length === 1 ? integerPart : `${integerPart}.${decimalPart.slice(0, 2)}`;

    setQuickAddAmount(nextValue);
  };

  const handleSelectQuickAddCategory = (category: string) => {
    setQuickAddCategory(category);
    setIsQuickAddCategoryPickerOpen(false);
  };

  const handleToggleQuickAddCategoryPicker = () => {
    setIsQuickAddCategoryPickerOpen((current) => !current);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const handleToggleQuickAddDatePicker = () => {
    setIsQuickAddDatePickerOpen((current) => !current);
    setIsQuickAddCategoryPickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const setQuickAddDatePreset = (preset: 'today' | 'yesterday' | 'tomorrow') => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);

    if (preset === 'yesterday') {
      base.setDate(base.getDate() - 1);
    }

    if (preset === 'tomorrow') {
      base.setDate(base.getDate() + 1);
    }

    setQuickAddDate(base);
    setIsQuickAddDatePickerOpen(false);
    setIsQuickAddNativeDatePickerVisible(false);
  };

  const adjustQuickAddDateByDays = (days: number) => {
    setQuickAddDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const handleOpenQuickAddNativeDatePicker = () => {
    setIsQuickAddDatePickerOpen(true);
    setIsQuickAddNativeDatePickerVisible(true);
    setIsQuickAddCategoryPickerOpen(false);
  };

  const handleQuickAddNativeDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (event.type === 'set' && selectedDate) {
      const normalizedDate = new Date(selectedDate);
      normalizedDate.setHours(12, 0, 0, 0);
      setQuickAddDate(normalizedDate);
    }

    if (Platform.OS === 'android') {
      setIsQuickAddNativeDatePickerVisible(false);
    }
  };

  const animateModalDragBack = () => {
    Animated.spring(modalSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 170,
      friction: 11,
    }).start();
  };

  const animateQuickAddModalDragBack = () => {
    Animated.spring(quickAddSheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 170,
      friction: 11,
    }).start();
  };

  useEffect(() => {
    if (!isTransactionsModalMounted && !isTransactionsModalVisible) {
      return;
    }

    if (isTransactionsModalVisible) {
      Animated.timing(modalSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(modalSheetTranslateY, {
      toValue: MODAL_SHEET_CLOSED_TRANSLATE_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        modalSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
        setIsTransactionsModalMounted(false);
      }
    });
  }, [isTransactionsModalMounted, isTransactionsModalVisible, modalSheetTranslateY]);

  useEffect(() => {
    if (!isQuickAddModalMounted && !isQuickAddModalVisible) {
      return;
    }

    if (isQuickAddModalVisible) {
      Animated.timing(quickAddSheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(quickAddSheetTranslateY, {
      toValue: MODAL_SHEET_CLOSED_TRANSLATE_Y,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        quickAddSheetTranslateY.setValue(MODAL_SHEET_CLOSED_TRANSLATE_Y);
        setIsQuickAddModalMounted(false);
      }
    });
  }, [isQuickAddModalMounted, isQuickAddModalVisible, quickAddSheetTranslateY]);

  const modalPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const isPullingDown = gestureState.dy > 6;
        return isVertical && isPullingDown;
      },
      onPanResponderGrant: () => {
        modalSheetTranslateY.stopAnimation((value) => {
          modalDragStartY.current = value;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        const rawOffset = Math.max(0, modalDragStartY.current + gestureState.dy);
        modalSheetTranslateY.setValue(applyModalDragResistance(rawOffset));
      },
      onPanResponderRelease: (_event, gestureState) => {
        const currentOffset = Math.max(0, modalDragStartY.current + gestureState.dy);
        const shouldDismiss =
          currentOffset > MODAL_DRAG_DISMISS_DISTANCE ||
          (currentOffset > MODAL_DRAG_MIN_DISTANCE_FOR_VELOCITY_CLOSE &&
            gestureState.vy > MODAL_DRAG_DISMISS_VELOCITY);

        if (shouldDismiss) {
          handleCloseTransactionsModal();
          return;
        }

        animateModalDragBack();
      },
      onPanResponderTerminate: () => {
        animateModalDragBack();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const quickAddModalPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const isPullingDown = gestureState.dy > 6;
        return isVertical && isPullingDown;
      },
      onPanResponderGrant: () => {
        quickAddSheetTranslateY.stopAnimation((value) => {
          quickAddModalDragStartY.current = value;
        });
      },
      onPanResponderMove: (_event, gestureState) => {
        const rawOffset = Math.max(0, quickAddModalDragStartY.current + gestureState.dy);
        quickAddSheetTranslateY.setValue(applyModalDragResistance(rawOffset));
      },
      onPanResponderRelease: (_event, gestureState) => {
        const currentOffset = Math.max(0, quickAddModalDragStartY.current + gestureState.dy);
        const shouldDismiss =
          currentOffset > MODAL_DRAG_DISMISS_DISTANCE ||
          (currentOffset > MODAL_DRAG_MIN_DISTANCE_FOR_VELOCITY_CLOSE &&
            gestureState.vy > MODAL_DRAG_DISMISS_VELOCITY);

        if (shouldDismiss) {
          handleCloseQuickAddModal();
          return;
        }

        animateQuickAddModalDragBack();
      },
      onPanResponderTerminate: () => {
        animateQuickAddModalDragBack();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const modalBackdropBaseOpacity = modalSheetTranslateY.interpolate({
    inputRange: [0, MODAL_SHEET_CLOSED_TRANSLATE_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const backdropOpacity = modalBackdropBaseOpacity;
  const sheetTranslateY = modalSheetTranslateY;
  const quickAddBackdropOpacity = quickAddSheetTranslateY.interpolate({
    inputRange: [0, MODAL_SHEET_CLOSED_TRANSLATE_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextBlock}>
                  <Text style={styles.headerGreeting}>Boa tarde,</Text>
                  <Text style={styles.headerName}>Joao Silva</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAmountsVisible ? 'Ocultar saldos da tela' : 'Mostrar saldos da tela'
                  }
                  onPress={toggleAmountsVisibility}
                  style={({ pressed }) => [
                    styles.visibilityButton,
                    pressed && styles.visibilityButtonPressed,
                  ]}
                >
                  <Ionicons
                    name={isAmountsVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.dashboardStack}>
              <BalanceCard
                summary={data.summary}
                variationLabel="+8,4% vs mes anterior"
                hideAmounts={!isAmountsVisible}
              />

              <View style={styles.statsRow}>
                <SummaryStatCard
                  label="Entradas"
                  amount={data.summary.income}
                  type="income"
                  style={styles.statCard}
                  hideAmounts={!isAmountsVisible}
                />
                <SummaryStatCard
                  label="Saidas"
                  amount={data.summary.expense}
                  type="expense"
                  style={styles.statCard}
                  hideAmounts={!isAmountsVisible}
                />
              </View>

              <MonthlyBarChart data={data.weeklyFlow} hideValues={!isAmountsVisible} />

              <View style={styles.recentSection}>
                <SectionHeader
                  title="Últimos lançamentos"
                  actionLabel="Ver todos"
                  onActionPress={handleSeeAllPress}
                />

                <Card noPadding style={styles.transactionsCard}>
                  {data.recentTransactions.map((transaction, index) => (
                    <TransactionListItem
                      key={transaction.id}
                      item={transaction}
                      showDivider={index < data.recentTransactions.length - 1}
                      hideAmounts={!isAmountsVisible}
                    />
                  ))}
                </Card>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleSeeAllPress}
                  style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}
                >
                  <Text style={styles.moreButtonText}>Ver todos os lançamentos</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <Modal
            visible={isTransactionsModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCloseTransactionsModal}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de lancamentos"
                onPress={handleCloseTransactionsModal}
                style={styles.modalBackdrop}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.modalBackdropFill, { opacity: backdropOpacity }]}
                />
              </Pressable>

              <Animated.View
                style={[
                  styles.modalSheet,
                  {
                    transform: [{ translateY: sheetTranslateY }],
                  },
                ]}
              >
                <View {...modalPanResponder.panHandlers} style={styles.modalDragRegion}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Todos os lancamentos</Text>
                      <Text style={styles.modalSubtitle}>{data.summary.monthLabel}</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                      onPress={handleCloseTransactionsModal}
                      style={({ pressed }) => [
                        styles.modalCloseButton,
                        pressed && styles.modalCloseButtonPressed,
                      ]}
                    >
                      <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Card noPadding style={styles.modalTransactionsCard}>
                    {data.recentTransactions.map((transaction, index) => (
                      <TransactionListItem
                        key={`modal-${transaction.id}`}
                        item={transaction}
                        showDivider={index < data.recentTransactions.length - 1}
                        hideAmounts={!isAmountsVisible}
                      />
                    ))}
                  </Card>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCloseTransactionsModal}
                    style={({ pressed }) => [
                      styles.modalDoneButton,
                      pressed && styles.modalDoneButtonPressed,
                    ]}
                  >
                    <Text style={styles.modalDoneButtonText}>Fechar</Text>
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>

          <Modal
            visible={isQuickAddModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCloseQuickAddModal}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de novo lançamento"
                onPress={handleCloseQuickAddModal}
                style={styles.modalBackdrop}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.modalBackdropFill, { opacity: quickAddBackdropOpacity }]}
                />
              </Pressable>

              <Animated.View
                style={[
                  styles.modalSheet,
                  styles.quickAddSheet,
                  {
                    transform: [{ translateY: quickAddSheetTranslateY }],
                  },
                ]}
              >
                <View {...quickAddModalPanResponder.panHandlers} style={styles.modalDragRegion}>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Novo lançamento</Text>
                      <Text style={styles.modalSubtitle}>Adicione uma movimentacao rapidamente</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fechar"
                      onPress={handleCloseQuickAddModal}
                      style={({ pressed }) => [
                        styles.modalCloseButton,
                        pressed && styles.modalCloseButtonPressed,
                      ]}
                    >
                      <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.quickAddBody}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.quickAddScroll}
                    contentContainerStyle={styles.quickAddScrollContent}
                  >
                    <View style={styles.quickAddContent}>
                      <Text style={styles.quickAddSectionLabel}>Tipo</Text>

                      <View style={styles.quickAddTypeRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setQuickAddType('income')}
                          style={({ pressed }) => [
                            styles.quickAddTypeButton,
                            quickAddType === 'income' && styles.quickAddTypeButtonIncomeActive,
                            pressed && styles.quickAddTypeButtonPressed,
                          ]}
                        >
                          <Ionicons
                            name="trending-up"
                            size={16}
                            color={quickAddType === 'income' ? colors.success : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.quickAddTypeButtonText,
                              quickAddType === 'income' &&
                              styles.quickAddTypeButtonTextIncomeActive,
                            ]}
                          >
                            Receita
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setQuickAddType('expense')}
                          style={({ pressed }) => [
                            styles.quickAddTypeButton,
                            quickAddType === 'expense' && styles.quickAddTypeButtonExpenseActive,
                            pressed && styles.quickAddTypeButtonPressed,
                          ]}
                        >
                          <Ionicons
                            name="trending-down"
                            size={16}
                            color={quickAddType === 'expense' ? colors.danger : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.quickAddTypeButtonText,
                              quickAddType === 'expense' &&
                              styles.quickAddTypeButtonTextExpenseActive,
                            ]}
                          >
                            Despesa
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.quickAddPreviewCard}>
                        <View style={styles.quickAddPreviewRow}>
                          <Text style={styles.quickAddPreviewLabel}>Valor</Text>
                          <View style={styles.quickAddAmountInputWrap}>
                            <Text style={styles.quickAddAmountPrefix}>R$</Text>
                            <TextInput
                              value={quickAddAmount}
                              onChangeText={handleQuickAddAmountChange}
                              placeholder="0.00"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="decimal-pad"
                              style={styles.quickAddAmountInput}
                              textAlign="right"
                              returnKeyType="done"
                            />
                          </View>
                        </View>
                        <View style={styles.quickAddPreviewDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={handleToggleQuickAddCategoryPicker}
                          style={({ pressed }) => [
                            styles.quickAddPreviewRow,
                            pressed && styles.quickAddPreviewRowPressed,
                          ]}
                        >
                          <Text style={styles.quickAddPreviewLabel}>Categoria</Text>
                          <View style={styles.quickAddPreviewTrailing}>
                            <Text
                              style={[
                                styles.quickAddPreviewPlaceholder,
                                quickAddCategory && styles.quickAddPreviewValueSelected,
                              ]}
                            >
                              {quickAddCategory ?? 'Selecionar'}
                            </Text>
                            <Ionicons
                              name={isQuickAddCategoryPickerOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                        </Pressable>
                        <View style={styles.quickAddPreviewDivider} />
                        <Pressable
                          accessibilityRole="button"
                          onPress={handleToggleQuickAddDatePicker}
                          style={({ pressed }) => [
                            styles.quickAddPreviewRow,
                            pressed && styles.quickAddPreviewRowPressed,
                          ]}
                        >
                          <Text style={styles.quickAddPreviewLabel}>Data</Text>
                          <View style={styles.quickAddPreviewTrailing}>
                            <Text
                              style={[
                                styles.quickAddPreviewPlaceholder,
                                styles.quickAddPreviewValueSelected,
                              ]}
                            >
                              {formatQuickAddDate(quickAddDate)}
                            </Text>
                            <Ionicons
                              name={isQuickAddDatePickerOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textSecondary}
                            />
                          </View>
                        </Pressable>
                      </View>

                      {isQuickAddCategoryPickerOpen ? (
                        <Card style={styles.quickAddDropdownCard}>
                          <Text style={styles.quickAddDropdownTitle}>Categorias</Text>
                          <View style={styles.quickAddCategoryChips}>
                            {QUICK_ADD_CATEGORY_OPTIONS.map((category) => {
                              const selected = quickAddCategory === category;

                              return (
                                <Pressable
                                  key={category}
                                  accessibilityRole="button"
                                  onPress={() => handleSelectQuickAddCategory(category)}
                                  style={({ pressed }) => [
                                    styles.quickAddCategoryChip,
                                    selected && styles.quickAddCategoryChipActive,
                                    pressed && styles.quickAddCategoryChipPressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.quickAddCategoryChipText,
                                      selected && styles.quickAddCategoryChipTextActive,
                                    ]}
                                  >
                                    {category}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </Card>
                      ) : null}

                      {isQuickAddDatePickerOpen ? (
                        <Card style={styles.quickAddDropdownCard}>
                          <Text style={styles.quickAddDropdownTitle}>Data do lançamento</Text>

                          <View style={styles.quickAddDatePresets}>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setQuickAddDatePreset('yesterday')}
                              style={({ pressed }) => [
                                styles.quickAddDatePresetChip,
                                pressed && styles.quickAddDatePresetChipPressed,
                              ]}
                            >
                              <Text style={styles.quickAddDatePresetChipText}>Ontem</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setQuickAddDatePreset('today')}
                              style={({ pressed }) => [
                                styles.quickAddDatePresetChip,
                                styles.quickAddDatePresetChipPrimary,
                                pressed && styles.quickAddDatePresetChipPressed,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quickAddDatePresetChipText,
                                  styles.quickAddDatePresetChipTextPrimary,
                                ]}
                              >
                                Hoje
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => setQuickAddDatePreset('tomorrow')}
                              style={({ pressed }) => [
                                styles.quickAddDatePresetChip,
                                pressed && styles.quickAddDatePresetChipPressed,
                              ]}
                            >
                              <Text style={styles.quickAddDatePresetChipText}>Amanha</Text>
                            </Pressable>
                          </View>

                          <View style={styles.quickAddDateStepper}>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => adjustQuickAddDateByDays(-1)}
                              style={({ pressed }) => [
                                styles.quickAddDateStepButton,
                                pressed && styles.quickAddDateStepButtonPressed,
                              ]}
                            >
                              <Ionicons name="remove" size={18} color={colors.textPrimary} />
                            </Pressable>

                            <Text style={styles.quickAddDateStepperText}>
                              {formatQuickAddDate(quickAddDate)}
                            </Text>

                            <Pressable
                              accessibilityRole="button"
                              onPress={() => adjustQuickAddDateByDays(1)}
                              style={({ pressed }) => [
                                styles.quickAddDateStepButton,
                                pressed && styles.quickAddDateStepButtonPressed,
                              ]}
                            >
                              <Ionicons name="add" size={18} color={colors.textPrimary} />
                            </Pressable>
                          </View>

                          <Pressable
                            accessibilityRole="button"
                            onPress={handleOpenQuickAddNativeDatePicker}
                            style={({ pressed }) => [
                              styles.quickAddOpenCalendarButton,
                              pressed && styles.quickAddOpenCalendarButtonPressed,
                            ]}
                          >
                            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                            <Text style={styles.quickAddOpenCalendarButtonText}>
                              Escolher no calendario
                            </Text>
                          </Pressable>

                          {isQuickAddNativeDatePickerVisible ? (
                            <View style={styles.quickAddNativeDatePickerWrap}>
                              <DateTimePicker
                                value={quickAddDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                                onChange={handleQuickAddNativeDateChange}
                              />

                              {Platform.OS === 'ios' ? (
                                <Pressable
                                  accessibilityRole="button"
                                  onPress={() => setIsQuickAddNativeDatePickerVisible(false)}
                                  style={({ pressed }) => [
                                    styles.quickAddCalendarDoneButton,
                                    pressed && styles.quickAddCalendarDoneButtonPressed,
                                  ]}
                                >
                                  <Text style={styles.quickAddCalendarDoneButtonText}>Concluir</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
                        </Card>
                      ) : null}
                    </View>
                  </ScrollView>

                  <View style={styles.quickAddFooter}>
                    <View style={styles.quickAddActions}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={handleCloseQuickAddModal}
                        style={({ pressed }) => [
                          styles.quickAddSecondaryButton,
                          pressed && styles.quickAddSecondaryButtonPressed,
                        ]}
                      >
                        <Text style={styles.quickAddSecondaryButtonText}>Cancelar</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={handleConfirmQuickAdd}
                        style={({ pressed }) => [
                          styles.quickAddPrimaryButton,
                          pressed && styles.quickAddPrimaryButtonPressed,
                        ]}
                      >
                        <Text style={styles.quickAddPrimaryButtonText}>Continuar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>
          </Modal>

          <FloatingActionButton onPress={handleFabPress} style={styles.fab} />
          <BottomTabBarMock style={styles.tabBar} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: BOTTOM_TAB_BAR_HEIGHT + FAB_SIZE + spacing.xl + spacing.lg,
  },
  header: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerGreeting: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  headerName: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  visibilityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visibilityButtonPressed: {
    opacity: 0.75,
  },
  dashboardStack: {
    gap: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
  },
  recentSection: {
    gap: spacing.lg,
  },
  transactionsCard: {
    overflow: 'hidden',
  },
  moreButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.mutedSurface,
  },
  moreButtonPressed: {
    opacity: 0.8,
  },
  moreButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: BOTTOM_TAB_BAR_HEIGHT + spacing.lg,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalDragRegion: {
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modalHeaderTextBlock: {
    flex: 1,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseButtonPressed: {
    opacity: 0.75,
  },
  modalScrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  modalTransactionsCard: {
    overflow: 'hidden',
  },
  modalDoneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  modalDoneButtonPressed: {
    opacity: 0.9,
  },
  modalDoneButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  quickAddSheet: {
    maxHeight: '96%',
    minHeight: '78%',
    overflow: 'hidden',
  },
  quickAddBody: {
    flex: 1,
  },
  quickAddScroll: {
    flex: 1,
  },
  quickAddScrollContent: {
    paddingBottom: spacing.lg,
  },
  quickAddContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  quickAddSectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quickAddTypeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickAddTypeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickAddTypeButtonIncomeActive: {
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    borderColor: 'rgba(22, 163, 74, 0.28)',
  },
  quickAddTypeButtonExpenseActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.28)',
  },
  quickAddTypeButtonPressed: {
    opacity: 0.85,
  },
  quickAddTypeButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddTypeButtonTextIncomeActive: {
    color: colors.success,
  },
  quickAddTypeButtonTextExpenseActive: {
    color: colors.danger,
  },
  quickAddPreviewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  quickAddPreviewRow: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quickAddPreviewRowPressed: {
    backgroundColor: colors.mutedSurface,
  },
  quickAddPreviewLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  quickAddAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    minWidth: 120,
  },
  quickAddAmountPrefix: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quickAddAmountInput: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    minWidth: 68,
    paddingVertical: 0,
  },
  quickAddPreviewValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddPreviewPlaceholder: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddPreviewValueSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddPreviewTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickAddPreviewDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  quickAddDropdownCard: {
    gap: spacing.md,
  },
  quickAddDropdownTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddCategoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddCategoryChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickAddCategoryChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  quickAddCategoryChipPressed: {
    opacity: 0.85,
  },
  quickAddCategoryChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddCategoryChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddDatePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddDatePresetChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickAddDatePresetChipPrimary: {
    backgroundColor: '#DBEAFE',
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  quickAddDatePresetChipPressed: {
    opacity: 0.85,
  },
  quickAddDatePresetChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddDatePresetChipTextPrimary: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddDateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  quickAddNativeDatePickerWrap: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  quickAddDateStepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mutedSurface,
  },
  quickAddDateStepButtonPressed: {
    opacity: 0.8,
  },
  quickAddDateStepperText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickAddOpenCalendarButton: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickAddOpenCalendarButtonPressed: {
    opacity: 0.85,
  },
  quickAddOpenCalendarButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddCalendarDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  quickAddCalendarDoneButtonPressed: {
    opacity: 0.85,
  },
  quickAddCalendarDoneButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  quickAddActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickAddFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  quickAddSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddSecondaryButtonPressed: {
    opacity: 0.8,
  },
  quickAddSecondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  quickAddPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddPrimaryButtonPressed: {
    opacity: 0.92,
  },
  quickAddPrimaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
