import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, Platform, TouchableOpacity, View } from 'react-native';


import { AppScreen } from '@/components/layout/app-screen';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

type FAQItem = {
  questionKey: string;
  answerKey: string;
};

const FAQ_DATA: FAQItem[] = [
  { questionKey: 'screens.faq.q1', answerKey: 'screens.faq.a1' },
  { questionKey: 'screens.faq.q2', answerKey: 'screens.faq.a2' },
  { questionKey: 'screens.faq.q3', answerKey: 'screens.faq.a3' },
  { questionKey: 'screens.faq.q4', answerKey: 'screens.faq.a4' },
  { questionKey: 'screens.faq.q5', answerKey: 'screens.faq.a5' },
  { questionKey: 'screens.faq.q6', answerKey: 'screens.faq.a6' },
  { questionKey: 'screens.faq.q7', answerKey: 'screens.faq.a7' },
]; 

export default function FAQScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <AppScreen titleKey="tabs.faq">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.headline, { color: palette.textOnSurface }]}>
          {t('screens.faq.headline')}
        </Text>

        {FAQ_DATA.map((item, index) => (
          <View key={index} style={[styles.faqItem, { borderColor: palette.border }]}>
            <TouchableOpacity onPress={() => toggleExpand(item.questionKey)} style={styles.questionContainer}>
              <Text style={[styles.question, { color: palette.textOnSurface }]}>
                {t(item.questionKey)}
              </Text>
              <Ionicons
                name={expanded[item.questionKey] ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={palette.inputPlaceholder}
              />
            </TouchableOpacity>
            {expanded[item.questionKey] && (
              <Text style={[styles.answer, { color: palette.inputPlaceholder }]}>
                {t(item.answerKey)}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 108 : 96, // Ajustado para la barra de pestañas flotante
    gap: 16,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  faqItem: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  questionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  answer: {
    fontSize: 14,
    lineHeight: 20,
  },
});