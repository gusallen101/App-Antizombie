import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  View,
} from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { API_CONFIG } from '@/constants/config';
import { useAppTheme } from '@/providers/app-theme-provider';
import { useLocalization } from '@/providers/localization-provider';

// --------- Tipos ---------
type Invitation = {
  id: string;
  usuario_nombre: string; // quien comparte (o nombre destinatario si es enviada)
  categoria: string; // nombre lista
  status?: 'pendiente' | 'aceptado' | 'rechazado';
  tipo?: 'recibida' | 'enviada';
  avatar?: string;
};

// --------- Componente ---------
export default function NotificationsScreen() {
  const { palette } = useAppTheme();
  const { t } = useLocalization();
  const router = useRouter();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // --------- Fetch ---------
  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);

      const [apikey, userId] = await Promise.all([
        AsyncStorage.getItem('@auth:apikey'),
        AsyncStorage.getItem('@auth:userId'),
      ]);

      if (!apikey || !userId) {
        throw new Error(t('auth.loginErrorFallback'));
      }

      // Petición paralela para recibidas y enviadas
      const [pendRes, sentRes] = await Promise.all([
        fetch(`${API_CONFIG.baseUrl}listas/pendientes/${userId}`, { headers: { apikey } }),
        fetch(`${API_CONFIG.baseUrl}listas/enviadas/${userId}`, { headers: { apikey } }),
      ]);

      const pendData = await pendRes.json().catch(() => []);
      const sentData = await sentRes.json().catch(() => []);

      if (!pendRes.ok && !sentRes.ok) {
        throw new Error(t('screens.notifications.fetchError'));
      }

      setInvitations(pendData);
      setSentInvitations(sentData);

    } catch (error) {
      console.warn('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // --------- Cargar al enfocar ---------
  useFocusEffect(
    useCallback(() => {
      void fetchInvitations();
    }, [fetchInvitations])
  );

  // --------- Aceptar ---------
  const handleAccept = useCallback(async (id: string) => {
    try {
      setProcessingId(id);

      const apikey = await AsyncStorage.getItem('@auth:apikey');

      const params = new URLSearchParams();
      params.append('id', String(id));

      const response = await fetch(`${API_CONFIG.baseUrl}listas/aceptar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey: apikey ?? '',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error();
      }

      // Filtramos asegurando que el tipo de dato coincida (ID de invitación)
      setInvitations((prev) => prev.filter((i) => String(i.id) !== String(id)));

      Alert.alert(t('screens.financialHealth.copyDone'), t('screens.notifications.acceptSuccess'));

    } catch {
      Alert.alert(t('screens.pending.shareTitle'), t('screens.notifications.acceptError'));
    } finally {
      setProcessingId(null);
    }
  }, [t]);

  // --------- Rechazar ---------
  const handleReject = useCallback(async (id: string) => {
    try {
      setProcessingId(id);

      const apikey = await AsyncStorage.getItem('@auth:apikey');

      const params = new URLSearchParams();
      params.append('id', String(id));

      const response = await fetch(`${API_CONFIG.baseUrl}listas/rechazar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          apikey: apikey ?? '',
        },
        body: params.toString(),
      });

      if (!response.ok) throw new Error();

      setInvitations((prev) => prev.filter((i) => String(i.id) !== String(id)));

    } catch {
      Alert.alert(t('screens.pending.shareTitle'), t('screens.notifications.rejectError'));
    } finally {
      setProcessingId(null);
    }
  }, [t]);

  // --------- Render ---------
  return (
    <AppScreen titleKey="tabs.notifications">
      <ScrollView contentContainerStyle={styles.content}>

        <TouchableOpacity 
          style={styles.backLink} 
          onPress={() => router.back()}
        >
          <Ionicons {...({} as any)} name="arrow-back" size={20} color={palette.primary} />
          <Text style={[styles.backLinkText, { color: palette.primary }]}>{t('common.goBack')}</Text>
        </TouchableOpacity>

        {/* Tabs de navegación */}
        <View style={[styles.tabs, { borderColor: palette.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'received' && { backgroundColor: palette.primary },
            ]}
            onPress={() => setActiveTab('received')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'received' ? palette.buttonText : palette.textPrimary },
              ]}
            >
              {t('screens.notifications.receivedTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'sent' && { backgroundColor: palette.primary },
            ]}
            onPress={() => setActiveTab('sent')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'sent' ? palette.buttonText : palette.textPrimary },
              ]}
            >
              {t('screens.notifications.sentTab')}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.feedback}>
            <Ionicons {...({} as any)} name="hourglass-outline" size={24} color={palette.primary} />
          </View>

        ) : (activeTab === 'received' ? invitations : sentInvitations).length === 0 ? (
          <View style={styles.feedback}>
            <Text style={[styles.feedbackText, { color: palette.inputPlaceholder }]}>
              {activeTab === 'received' 
                ? t('screens.notifications.emptyReceived') 
                : t('screens.notifications.emptySent')}
            </Text>
          </View>

        ) : (
          (activeTab === 'received' ? invitations : sentInvitations).map((inv) => {
            const processing = processingId === inv.id;

            return (
              <View
                key={inv.id}
                style={[styles.card, { backgroundColor: palette.surface }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary + '20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {inv.avatar ? (
                      <Image 
                        source={{ 
                          uri: inv.avatar.startsWith('http') 
                            ? inv.avatar 
                            : `${API_CONFIG.baseUrl.replace(/\/$/, '')}/${inv.avatar.replace(/^\//, '')}` 
                        }} 
                        style={{ width: 44, height: 44 }} 
                      />
                    ) : (
                      <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 18 }}>
                        {inv.usuario_nombre?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: palette.textOnSurface }]}>
                      {inv.usuario_nombre}
                    </Text>
                    <Text style={[styles.subtitle, { color: palette.inputPlaceholder }]}>
                      {activeTab === 'received' 
                        ? t('screens.notifications.inviteText')
                        : t('screens.notifications.sentTo', { name: inv.usuario_nombre })}
                    </Text>
                  </View>
                </View>

                {activeTab === 'received' && (
                  <Text style={[styles.listName, { color: palette.primary }]}>
                    {inv.categoria}
                  </Text>
                )}

                {activeTab === 'sent' && (
                  <View style={styles.sentInfoRow}>
                    <Text style={[styles.listName, { color: palette.primary, marginBottom: 0 }]}>
                      {inv.categoria}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Ionicons {...({} as any)} 
                        name={inv.status === 'aceptado' ? "checkmark-circle" : "time-outline"} 
                        size={16} 
                        color={inv.status === 'aceptado' ? "#4CD964" : "#FFCC00"} 
                      />
                      <Text style={[styles.statusText, { color: inv.status === 'aceptado' ? "#4CD964" : "#FFCC00" }]}>
                        {inv.status === 'aceptado' ? t('screens.notifications.statusAccepted') : t('screens.notifications.statusPending')}
                      </Text>
                    </View>
                  </View>
                )}

                {activeTab === 'received' && (
                  <View style={styles.actions}>

                    <TouchableOpacity
                      style={[
                        styles.accept,
                        { backgroundColor: processing ? palette.border : palette.primary }
                      ]}
                      onPress={() => handleAccept(inv.id)}
                      disabled={processing}
                    >
                      <Text style={[styles.acceptText, { color: palette.buttonText }]}>
                        {processing ? t('screens.notifications.processing') : t('screens.notifications.accept')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.reject,
                        { borderColor: palette.border }
                      ]}
                      onPress={() => handleReject(inv.id)}
                      disabled={processing}
                    >
                      <Text style={{ color: palette.textOnSurface }}>
                        {t('screens.notifications.reject')}
                      </Text>
                    </TouchableOpacity>

                  </View>
                )}

              </View>
            );
          })
        )}

      </ScrollView>
    </AppScreen>
  );
}

// --------- Estilos ---------
const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabLabel: {
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  sentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  accept: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptText: {
    fontWeight: '600',
  },
  reject: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  feedback: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  feedbackText: {
    fontSize: 14,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});