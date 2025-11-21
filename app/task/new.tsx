import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import { auth, db } from '@/firebaseConfig';
import { addDoc, collection } from 'firebase/firestore';

export default function NewTaskScreen() {
  const router = useRouter();
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const user = auth.currentUser;

  if (!user) {
    return <Redirect href="/" />;
  }

  const handleCreateTask = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Atenção', 'Usuário não autenticado.');
      return;
    }
    if (!clientName || !description) {
      Alert.alert('Atenção', 'Preencha o nome do cliente e a descrição.');
      return;
    }

    try {
      setSaving(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Atenção', 'Permissão de localização é obrigatória para criar a tarefa.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({});

      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10);
      const tasksRef = collection(db, 'tasks');
      await addDoc(tasksRef, {
        clientName: clientName.trim(),
        description: description.trim(),
        date: dateKey,
        status: 'pending',
        userId: user.uid,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        },
      });

      try {
        const { status: calendarStatus } = await Calendar.requestCalendarPermissionsAsync();
        if (calendarStatus === 'granted') {
          const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
          const defaultCalendar = calendars[0];

          if (defaultCalendar) {
            const [year, month, day] = dateKey.split('-').map(Number);
            const startDate = new Date(year, month - 1, day, 9, 0);
            const endDate = new Date(year, month - 1, day, 10, 0);

            await Calendar.createEventAsync(defaultCalendar.id, {
              title: `Visita: ${clientName.trim()}`,
              notes: description.trim(),
              startDate,
              endDate,
            });
          }
        }
      } catch (calendarError) {
        // Opcional: logar o erro de calendário sem bloquear a criação da tarefa
        console.log('Erro ao criar evento no calendário', calendarError);
      }

      router.back();
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível criar a tarefa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Nova Tarefa
      </ThemedText>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>Dados da tarefa</ThemedText>

        <View style={styles.form}>
          <ThemedText style={styles.label}>Nome do cliente</ThemedText>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Digite o nome do cliente"
          />

          <ThemedText style={styles.label}>Descrição do serviço</ThemedText>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva o serviço a ser realizado"
            multiline
          />
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleCreateTask} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText type="defaultSemiBold" style={styles.buttonText}>
            Criar tarefa
          </ThemedText>
        )}
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  form: {
    marginTop: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
