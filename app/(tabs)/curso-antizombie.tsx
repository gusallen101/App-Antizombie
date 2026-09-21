import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/layout/app-header';
import { useAppTheme } from '@/providers/app-theme-provider';

type ApiLesson = {
  id: string;
  title: string;
  completed?: boolean;
  duration?: string;
  description?: string;
};

type ApiModule = {
  id: string;
  title: string;
  subtitle?: string;
  lessons: ApiLesson[];
};

type ApiCourse = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  level: string;
  progress: number;
  modules: ApiModule[];
};

const courseFromApi: ApiCourse = {
  id: 'curso-antizombie',
  title: 'Curso Antizombie',
  subtitle: 'Aprende a reforzar hábitos, detectar patrones y mantener tu progreso con una rutina clara.',
  duration: '4 semanas',
  level: 'Nivel 1',
  progress: 38,
  modules: [
    {
      id: 'module-1',
      title: 'Módulo 1',
      subtitle: 'Fundamentos del antizombie',
      lessons: [
        { id: 'l1', title: 'Introducción', completed: true, duration: '03:20' },
        { id: 'l2', title: 'Diagnóstico', completed: true, duration: '04:10' },
        { id: 'l3', title: 'Objetivos', completed: false, duration: '02:45' },
      ],
    },
    {
      id: 'module-2',
      title: 'Módulo 2',
      subtitle: 'Acciones prácticas',
      lessons: [
        { id: 'l4', title: 'Rutinas', completed: false, duration: '05:00' },
        { id: 'l5', title: 'Reforzamiento', completed: false, duration: '04:40' },
        { id: 'l6', title: 'Seguimiento', completed: false, duration: '03:55' },
      ],
    },
    {
      id: 'module-3',
      title: 'Módulo 3',
      subtitle: 'Sistemas y hábitos',
      lessons: [
        { id: 'l7', title: 'Hábitos', completed: false, duration: '04:15' },
        { id: 'l8', title: 'Checklist', completed: false, duration: '02:50' },
        { id: 'l9', title: 'Evaluación final', completed: false, duration: '06:00' },
      ],
    },
  ],
};

export default function CursoAntizombieScreen() {
  const { palette } = useAppTheme();

  const totalLessons = courseFromApi.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const completedLessons = courseFromApi.modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => lesson.completed).length,
    0,
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <AppHeader title="Curso Antizombie" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6E1F7C', '#2CA6A4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Curso premium</Text>
            </View>
            <Text style={styles.heroLevel}>{courseFromApi.level}</Text>
          </View>

          <Text style={styles.heroTitle}>{courseFromApi.title}</Text>
          <Text style={styles.heroSubtitle}>{courseFromApi.subtitle}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#FFF" />
              <Text style={styles.metaText}>{courseFromApi.duration}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="play-circle-outline" size={16} color="#FFF" />
              <Text style={styles.metaText}>{totalLessons} lecciones</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.progressCard, { backgroundColor: palette.surface }]}> 
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: palette.textOnSurface }]}>Tu progreso</Text>
            <Text style={[styles.progressValue, { color: palette.primary }]}>{courseFromApi.progress}%</Text>
          </View>

          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${courseFromApi.progress}%` }]} />
          </View>

          <Text style={[styles.progressText, { color: palette.textOnSurface }]}> 
            {completedLessons} de {totalLessons} actividades completadas
          </Text>

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
            <Text style={[styles.primaryButtonText, { color: palette.buttonText }]}>Continuar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.textOnSurface }]}>Módulos del curso</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}> {courseFromApi.modules.length} módulos</Text>
        </View>

        {courseFromApi.modules.map((module) => {
          const completedCount = module.lessons.filter((lesson) => lesson.completed).length;

          return (
            <View key={module.id} style={[styles.moduleCard, { backgroundColor: palette.surface }]}>
              <View style={styles.moduleHeader}>
                <View>
                  <Text style={[styles.moduleTitle, { color: palette.textOnSurface }]}>{module.title}</Text>
                  <Text style={[styles.moduleSubtitle, { color: palette.textSecondary }]}>{module.subtitle}</Text>
                </View>
                <View style={[styles.moduleBadge, { backgroundColor: `${palette.primary}18` }]}>
                  <Text style={[styles.moduleBadgeText, { color: palette.primary }]}>
                    {completedCount}/{module.lessons.length}
                  </Text>
                </View>
              </View>

              {module.lessons.map((lesson, index) => (
                <View key={lesson.id} style={styles.lessonItem}>
                  <View style={styles.lessonLeft}>
                    <View
                      style={[
                        styles.lessonCircle,
                        {
                          backgroundColor: lesson.completed ? palette.primary : '#E6E6E6',
                        },
                      ]}
                    >
                      <Text style={styles.lessonCircleText}>{lesson.completed ? '✓' : index + 1}</Text>
                    </View>
                    <View style={styles.lessonBody}>
                      <Text style={[styles.lessonText, { color: palette.textOnSurface }]}>{lesson.title}</Text>
                      {lesson.duration ? <Text style={[styles.lessonMeta, { color: palette.textSecondary }]}>{lesson.duration}</Text> : null}
                    </View>
                  </View>

                  <Text style={[styles.lessonStatus, { color: lesson.completed ? palette.primary : palette.textSecondary }]}> 
                    {lesson.completed ? 'Completada' : 'Pendiente'}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 18,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    paddingTop: 16,
    minHeight: 200,
    justifyContent: 'space-between',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroLevel: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EAEAEA',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2CA6A4',
  },
  progressText: {
    marginTop: 10,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  moduleCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  moduleSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  moduleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  moduleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  lessonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  lessonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  lessonBody: {
    flex: 1,
  },
  lessonCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lessonCircleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  lessonText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  lessonMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  lessonStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
});
