import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, TouchableOpacity, View, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '@/firebaseConfig';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

type LocalTarefa = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
};

type Tarefa = {
  id: string;
  clientName: string;
  description: string;
  date: string;
  status: 'pending' | 'done';
  location?: LocalTarefa;
};

function formatarChaveData(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatarRotuloData(date: Date) {
  return date.toLocaleDateString('pt-BR');
}

function formatarCoordenada(value: number, decimals = 4) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value.toFixed(decimals);
}

export default function TelaTarefas() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const user = auth.currentUser;
  const userEmail = user?.email ?? '';

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const dateKey = formatarChaveData(selectedDate);
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', user.uid), where('date', '==', dateKey));

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const data: Tarefa[] = snapshot.docs.map((doc: any) => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          clientName: d.clientName,
          description: d.description,
          date: d.date,
          status: d.status ?? 'pending',
          location: d.location,
        };
      });
      setTasks(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [selectedDate]);

  useEffect(() => {
    if (!user) {
      setMarkedDates({});
      return;
    }

    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const marks: Record<string, any> = {};
      snapshot.docs.forEach((doc: any) => {
        const d = doc.data() as any;
        if (d.date) {
          marks[d.date] = {
            ...(marks[d.date] ?? {}),
            marked: true,
            dotColor: '#9ca3af',
          };
        }
      });
      setMarkedDates(marks);
    });

    return unsubscribe;
  }, []);

  const handleSair = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível sair.');
    }
  };

  const handleSelecionarData = (day: { dateString: string }) => {
    const [year, month, dayOfMonth] = day.dateString.split('-').map(Number);
    const nextDate = new Date(year, month - 1, dayOfMonth);
    setLoading(true);
    setSelectedDate(nextDate);
    setShowCalendar(false);
  };

  const handleAbrirCalendario = () => {
    setShowCalendar(true);
  };

  const handleFecharCalendario = () => {
    setShowCalendar(false);
  };

  const handleNovaTarefa = () => {
    router.push({ pathname: '/task/new' });
  };

  const totalTasks = tasks.length;
  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const pendingCount = totalTasks - doneCount;

  const renderizarTarefa = ({ item }: { item: Tarefa }) => {
    const isDone = item.status === 'done';
    const hasLocation =
      !!item.location &&
      typeof item.location.latitude === 'number' &&
      typeof item.location.longitude === 'number';

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() =>
          router.push({
            pathname: '/task/[id]',
            params: { id: item.id },
          })
        }
      >
        <View style={styles.taskHeaderRow}>
          <ThemedText type="defaultSemiBold" style={styles.taskClientName}>
            {item.clientName}
          </ThemedText>
          <View
            style={[
              styles.statusBadge,
              isDone ? styles.statusBadgeDone : styles.statusBadgePending,
            ]}
          >
            <ThemedText style={styles.statusBadgeText}>
              {isDone ? 'Concluída' : 'Pendente'}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={styles.taskDescription} numberOfLines={2}>
          {item.description}
        </ThemedText>
        {hasLocation && (
          <ThemedText style={styles.taskLocation}>
            {`Lat: ${formatarCoordenada(item.location!.latitude)}, Lon: ${formatarCoordenada(
              item.location!.longitude,
            )}`}
          </ThemedText>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <ThemedText type="title" style={styles.headerTitle}>
            Tarefas
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {userEmail ? `Olá, ${userEmail}` : 'Usuário não identificado'}
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSair}>
          <ThemedText type="defaultSemiBold" style={styles.logoutButtonText}>
            Menu
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.dateRow}>
          <View>
            <ThemedText style={styles.sectionLabel}>Data da rota</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.dateValue}>
              {formatarRotuloData(selectedDate)}
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.calendarButton} onPress={handleAbrirCalendario}>
            <ThemedText type="defaultSemiBold" style={styles.calendarButtonText}>
              Selecionar data
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <ThemedText style={styles.summaryLabel}>Total</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
              {totalTasks}
            </ThemedText>
          </View>
          <View style={styles.summaryCard}>
            <ThemedText style={styles.summaryLabel}>Pendentes</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
              {pendingCount}
            </ThemedText>
          </View>
          <View style={styles.summaryCard}>
            <ThemedText style={styles.summaryLabel}>Concluídas</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
              {doneCount}
            </ThemedText>
          </View>
        </View>
      </View>

      <Modal transparent visible={showCalendar} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Selecione a data
            </ThemedText>
            <Calendar
              current={formatarChaveData(selectedDate)}
              markedDates={{
                ...markedDates,
                [formatarChaveData(selectedDate)]: {
                  ...(markedDates[formatarChaveData(selectedDate)] ?? {}),
                  selected: true,
                  selectedColor: '#3b82f6',
                },
              }}
              onDayPress={handleSelecionarData}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={handleFecharCalendario}>
              <ThemedText type="defaultSemiBold" style={styles.modalCloseButtonText}>
                Fechar
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.listHeader}>
        <ThemedText type="subtitle" style={styles.listTitle}>
          Tarefas
        </ThemedText>
        <TouchableOpacity style={styles.newTaskButton} onPress={handleNovaTarefa}>
          <ThemedText type="defaultSemiBold" style={styles.newTaskButtonText}>
            Nova Tarefa
          </ThemedText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <ThemedText>Nenhuma tarefa para esta data.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderizarTarefa}
          contentContainerStyle={styles.listContent}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#6b7280',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ef4444',
  },
  logoutButtonText: {
    color: '#fff',
  },
  section: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  sectionLabel: {
    marginBottom: 4,
    color: '#6b7280',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: {
    marginTop: 2,
  },
  summaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
  },
  listHeader: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontSize: 18,
  },
  newTaskButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0a7ea4',
  },
  newTaskButtonText: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 24,
    gap: 8,
  },
  calendarButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0a7ea4',
  },
  calendarButtonText: {
    color: '#fff',
  },
  taskCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 4,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  taskClientName: {
    flex: 1,
    marginRight: 8,
  },
  taskDescription: {
    color: '#4b5563',
    marginTop: 2,
  },
  taskLocation: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeDone: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeText: {
    fontSize: 12,
    color: '#111827',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'white',
  },
  modalTitle: {
    marginBottom: 12,
  },
  modalCloseButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#6b7280',
  },
  modalCloseButtonText: {
    color: '#fff',
  },
});
