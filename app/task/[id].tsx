import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '@/firebaseConfig';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

type TaskLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
};

type TaskData = {
  clientName: string;
  description: string;
  date: string;
  status: 'pending' | 'done';
  whatWasDone?: string;
  photos?: string[]; // base64 strings
  technicianSignature?: string;
  clientSignature?: string;
  location?: TaskLocation;
};

function formatCoordinate(value: number, decimals = 4) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value.toFixed(decimals);
}

const MAX_PHOTOS = 2;

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState<TaskData | null>(null);
  const [whatWasDone, setWhatWasDone] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [clientSignature, setClientSignature] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const user = auth.currentUser;

  useEffect(() => {
    const loadTask = async () => {
      if (!user) {
        Alert.alert('Atenção', 'Usuário não autenticado.');
        return;
      }
      if (!id) {
        Alert.alert('Erro', 'Tarefa não encontrada.');
        router.back();
        return;
      }
      try {
        const refDoc = doc(db, 'tasks', String(id));
        const snap = await getDoc(refDoc);
        if (!snap.exists()) {
          Alert.alert('Erro', 'Tarefa não encontrada.');
          router.back();
          return;
        }
        const data = snap.data() as TaskData;
        setTask(data);
        setWhatWasDone(data.whatWasDone ?? '');
        setTechnicianSignature(data.technicianSignature ?? '');
        setClientSignature(data.clientSignature ?? '');
        setPhotos(data.photos ?? []);
      } catch (error: any) {
        Alert.alert('Erro', error?.message ?? 'Não foi possível carregar a tarefa.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [id, router]);

  if (!user) {
    return <Redirect href="/" />;
  }

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite de fotos', `Só é possível adicionar até ${MAX_PHOTOS} fotos por tarefa.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão negada', 'Não foi possível acessar a câmera.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) return;
        const base64Image = `data:image/jpeg;base64,${asset.base64}`;
        setPhotos((current) => [...current, base64Image].slice(0, MAX_PHOTOS));
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível tirar a foto.');
    }
  };

  const handleFinish = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Atenção', 'Usuário não autenticado.');
      return;
    }
    if (!id) {
      return;
    }
    if (!whatWasDone || !technicianSignature || !clientSignature) {
      Alert.alert('Atenção', 'Preencha o que foi feito e as assinaturas.');
      return;
    }

    try {
      setSaving(true);
      const taskId = String(id);

      const refDoc = doc(db, 'tasks', taskId);
      await updateDoc(refDoc, {
        whatWasDone: whatWasDone.trim(),
        technicianSignature: technicianSignature.trim(),
        clientSignature: clientSignature.trim(),
        photos,
        status: 'done',
      });

      router.back();
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível encerrar a tarefa.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Atenção', 'Usuário não autenticado.');
      return;
    }

    try {
      const taskId = String(id);
      const refDoc = doc(db, 'tasks', taskId);
      await deleteDoc(refDoc);
      router.back();
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível excluir a tarefa.');
    }
  };

  const handleDelete = () => {
    if (!id) {
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm('Tem certeza que deseja excluir esta tarefa?');
      if (confirmed) {
        void handleConfirmDelete();
      }
      return;
    }

    Alert.alert('Excluir tarefa', 'Tem certeza que deseja excluir esta tarefa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void handleConfirmDelete();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!task) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Tarefa não encontrada.</ThemedText>
      </ThemedView>
    );
  }

  const isDone = task.status === 'done';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Detalhe da tarefa
        </ThemedText>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <ThemedText style={styles.cardTitle}>Dados da tarefa</ThemedText>
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

          <ThemedText style={styles.taskClientName}>{task.clientName}</ThemedText>
          <ThemedText style={styles.taskDescription}>{task.description}</ThemedText>
          <ThemedText style={styles.taskDate}>
            {new Date(task.date).toLocaleDateString('pt-BR')}
          </ThemedText>
          {task.location &&
            typeof task.location.latitude === 'number' &&
            typeof task.location.longitude === 'number' && (
              <ThemedText style={styles.taskLocation}>
                {`Localização: ${formatCoordinate(task.location.latitude)}, ${formatCoordinate(
                  task.location.longitude,
                )}`}
              </ThemedText>
            )}
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Execução do serviço</ThemedText>

          <ThemedText style={styles.label}>O que foi feito</ThemedText>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={whatWasDone}
            onChangeText={setWhatWasDone}
            multiline
            placeholder="Descreva o serviço realizado"
          />

          <ThemedText style={styles.label}>Fotos (até {MAX_PHOTOS})</ThemedText>
          <View style={styles.photosRow}>
            {photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </View>
          <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
            <ThemedText type="defaultSemiBold" style={styles.photoButtonText}>
              Adicionar foto
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Assinaturas</ThemedText>

          <ThemedText style={styles.label}>Assinatura do técnico</ThemedText>
          <TextInput
            style={styles.input}
            value={technicianSignature}
            onChangeText={setTechnicianSignature}
            placeholder="Nome completo do técnico"
          />
          <ThemedText style={styles.label}>Assinatura do cliente</ThemedText>
          <TextInput
            style={styles.input}
            value={clientSignature}
            onChangeText={setClientSignature}
            placeholder="Nome completo do cliente"
          />
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinish}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.finishButtonText}>
                Confirmar encerramento
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <ThemedText type="defaultSemiBold" style={styles.deleteButtonText}>
              Excluir tarefa
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  taskClientName: {
    marginTop: 4,
    marginBottom: 2,
    fontWeight: '600',
  },
  taskDescription: {
    color: '#4b5563',
    marginBottom: 4,
  },
  taskDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  taskLocation: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  photoButton: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
  },
  photoButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 16,
  },
  finishButton: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#16a34a',
  },
  finishButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#fee2e2',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
});
