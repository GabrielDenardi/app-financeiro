import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { authTheme } from '../../../theme/authTheme';

type SelectableItem = {
  label: string;
  value: string;
};

type SelectableListProps = {
  items: SelectableItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
  searchPlaceholder: string;
};

export function SelectableList({
  items,
  selectedValue,
  onSelect,
  searchPlaceholder,
}: SelectableListProps) {
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [items, search]);

  return (
    <View style={styles.container}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={searchPlaceholder}
        placeholderTextColor={authTheme.colors.textSecondary}
        style={styles.searchInput}
      />

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredItems.map((item) => {
          const isSelected = selectedValue === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => onSelect(item.value)}
              style={({ pressed }) => [
                styles.row,
                isSelected && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}

        {filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum resultado encontrado.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
  },
  searchInput: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: authTheme.colors.border,
    backgroundColor: authTheme.colors.surface,
    paddingHorizontal: 14,
    color: authTheme.colors.textPrimary,
    fontSize: 15,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: authTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  rowPressed: {
    opacity: 0.78,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#C9BDDA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: authTheme.colors.brand,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: authTheme.colors.brand,
  },
  rowText: {
    color: authTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '500',
  },
  rowTextSelected: {
    color: authTheme.colors.brand,
    fontWeight: '700',
  },
  emptyText: {
    paddingTop: 16,
    fontSize: 14,
    color: authTheme.colors.textSecondary,
    textAlign: 'center',
  },
});
