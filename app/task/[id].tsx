import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '@/firebaseConfig';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

type LocalTarefa = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
};

type PontoAssinatura = {
  x: number;
  y: number;
  strokeId: number;
};

type DadosTarefa = {
  clientName: string;
  description: string;
  date: string;
  status: 'pending' | 'done';
  whatWasDone?: string;
  photos?: string[]; // base64 strings
  photoTimestamps?: number[];
  technicianSignature?: string;
  clientSignature?: string;
  location?: LocalTarefa;
  technicianSignaturePoints?: PontoAssinatura[];
  clientSignaturePoints?: PontoAssinatura[];
};

function formatarCoordenada(value: number, decimals = 4) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value.toFixed(decimals);
}

function formatarTimestampFoto(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '';
  }
  try {
    return new Date(timestamp).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

function montarAssinaturaSvg(points: PontoAssinatura[]): string {
  if (!points || points.length === 0) {
    return '';
  }

  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = Math.max(Math.ceil(maxX) + 4, 100);
  const height = Math.max(Math.ceil(maxY) + 4, 40);

  const strokes: Record<number, PontoAssinatura[]> = {};
  points.forEach((p) => {
    if (!strokes[p.strokeId]) {
      strokes[p.strokeId] = [];
    }
    strokes[p.strokeId].push(p);
  });

  const paths = Object.values(strokes)
    .map((stroke) => {
      if (stroke.length === 0) {
        return '';
      }
      const d = stroke
        .map((p, index) =>
          `${index === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
        )
        .join(' ');
      return `<path d="${d}" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join('');

  if (!paths) {
    return '';
  }

  return `
    <svg class="signature-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${paths}
    </svg>
  `;
}

const MAX_PHOTOS = 2;

export default function TelaDetalheTarefa() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState<DadosTarefa | null>(null);
  const [whatWasDone, setWhatWasDone] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [clientSignature, setClientSignature] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoTimestamps, setPhotoTimestamps] = useState<number[]>([]);
  const [technicianSignaturePoints, setTechnicianSignaturePoints] = useState<PontoAssinatura[]>([]);
  const [clientSignaturePoints, setClientSignaturePoints] = useState<PontoAssinatura[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [activeSignature, setActiveSignature] = useState<'technician' | 'client' | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
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
        const data = snap.data() as DadosTarefa;
        const photosFromData = data.photos ?? [];
        const photoTimestampsFromData = data.photoTimestamps ?? [];
        const normalizedPhotoTimestamps =
          photoTimestampsFromData.length >= photosFromData.length
            ? photoTimestampsFromData.slice(0, photosFromData.length)
            : [
                ...photoTimestampsFromData,
                ...Array(photosFromData.length - photoTimestampsFromData.length).fill(
                  Date.now(),
                ),
              ];

        setTask(data);
        setWhatWasDone(data.whatWasDone ?? '');
        setTechnicianSignature(data.technicianSignature ?? '');
        setClientSignature(data.clientSignature ?? '');
        setPhotos(photosFromData);
        setPhotoTimestamps(normalizedPhotoTimestamps);
        setTechnicianSignaturePoints(data.technicianSignaturePoints ?? []);
        setClientSignaturePoints(data.clientSignaturePoints ?? []);
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

  const handleAddPhotoFromCamera = async () => {
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
        const timestamp = Date.now();
        setPhotos((current) => [...current, base64Image].slice(0, MAX_PHOTOS));
        setPhotoTimestamps((current) => [...current, timestamp].slice(0, MAX_PHOTOS));
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível tirar a foto.');
    }
  };

  const handleAddPhotoFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite de fotos', `Só é possível adicionar até ${MAX_PHOTOS} fotos por tarefa.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão negada', 'Não foi possível acessar a galeria.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) return;
        const base64Image = `data:image/jpeg;base64,${asset.base64}`;
        const timestamp = Date.now();
        setPhotos((current) => [...current, base64Image].slice(0, MAX_PHOTOS));
        setPhotoTimestamps((current) => [...current, timestamp].slice(0, MAX_PHOTOS));
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível selecionar a foto.');
    }
  };

  const handleAddPhoto = () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite de fotos', `Só é possível adicionar até ${MAX_PHOTOS} fotos por tarefa.`);
      return;
    }

    Alert.alert('Adicionar foto', 'Escolha a origem da foto', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Câmera',
        onPress: () => {
          void handleAddPhotoFromCamera();
        },
      },
      {
        text: 'Galeria',
        onPress: () => {
          void handleAddPhotoFromGallery();
        },
      },
    ]);
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert('Remover foto', 'Deseja remover esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          setPhotos((current) => current.filter((_, i) => i !== index));
          setPhotoTimestamps((current) => current.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const handlePhotoPress = (index: number) => {
    Alert.alert('Foto', 'O que deseja fazer?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Visualizar',
        onPress: () => {
          setActivePhotoIndex(index);
          setPhotoModalVisible(true);
        },
      },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          handleRemovePhoto(index);
        },
      },
    ]);
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
        photoTimestamps,
        technicianSignaturePoints,
        clientSignaturePoints,
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

  const handleGeneratePdf = async () => {
    if (!task) {
      return;
    }

    if (task.status !== 'done') {
      Alert.alert('Atenção', 'Só é possível gerar PDF para tarefas concluídas.');
      return;
    }

    try {
      setGeneratingPdf(true);

      const [photo1, photo2] = photos;
      const [timestamp1, timestamp2] = photoTimestamps;

      const basePhotoTimestampLabel1 = formatarTimestampFoto(timestamp1);
      const basePhotoTimestampLabel2 = formatarTimestampFoto(timestamp2);

      let photoTimestampLabel1 = basePhotoTimestampLabel1;
      let photoTimestampLabel2 = basePhotoTimestampLabel2;

      if (
        task.location &&
        typeof task.location.latitude === 'number' &&
        typeof task.location.longitude === 'number'
      ) {
        const locationLabel = `Loc: ${formatarCoordenada(task.location.latitude)}, ${formatarCoordenada(
          task.location.longitude,
        )}`;
        if (basePhotoTimestampLabel1) {
          photoTimestampLabel1 = `${basePhotoTimestampLabel1} - ${locationLabel}`;
        }
        if (basePhotoTimestampLabel2) {
          photoTimestampLabel2 = `${basePhotoTimestampLabel2} - ${locationLabel}`;
        }
      }

      const photosHtml = `
        <div class="photo-slot">
          ${
            photo1
              ? `<div>
                   <img src="${photo1}" class="photo-img" />
                   ${
                     photoTimestampLabel1
                       ? `<p class="photo-timestamp">${photoTimestampLabel1}</p>`
                       : ''
                   }
                 </div>`
              : ''
          }
        </div>
        <div class="photo-slot">
          ${
            photo2
              ? `<div>
                   <img src="${photo2}" class="photo-img" />
                   ${
                     photoTimestampLabel2
                       ? `<p class="photo-timestamp">${photoTimestampLabel2}</p>`
                       : ''
                   }
                 </div>`
              : ''
          }
        </div>
      `;

      const technicianSignatureSvg = montarAssinaturaSvg(technicianSignaturePoints);
      const clientSignatureSvg = montarAssinaturaSvg(clientSignaturePoints);

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              html, body { margin: 0; padding: 0; height: 100%; }
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
              h1 { font-size: 20px; margin-bottom: 12px; }
              h2 { font-size: 16px; margin-top: 8px; margin-bottom: 4px; }
              p { margin: 2px 0; font-size: 14px; }
              .page { display: flex; flex-direction: column; min-height: 100vh; }
              .top-half { flex: 1; padding: 16px; box-sizing: border-box; }
              .bottom-half { flex: 1; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; }
              .section { margin-bottom: 8px; }
              .label { font-weight: 600; }
              .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background-color: #16a34a; color: #ffffff; font-size: 12px; }
              .photos-row { flex: 1; display: flex; flex-direction: row; gap: 12px; margin-top: 8px; }
              .photo-slot { flex: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
              .photo-img { width: 100%; height: auto; max-height: 100%; object-fit: contain; }
              .photo-timestamp { margin-top: 4px; font-size: 12px; color: #4b5563; text-align: center; }
              .signatures-row { display: flex; flex-direction: row; gap: 16px; margin-top: 8px; }
              .signature-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
              .signature-box { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; height: 120px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
              .signature-svg { width: 100%; height: 100%; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="top-half">
                <h1>Relatório de Tarefa</h1>

                <div class="section">
                  <span class="badge">Concluída</span>
                </div>

                <div class="section">
                  <h2>Dados da tarefa</h2>
                  <p><span class="label">Cliente:</span> ${task.clientName}</p>
                  <p><span class="label">Descrição:</span> ${task.description}</p>
                  <p><span class="label">Data:</span> ${new Date(task.date).toLocaleDateString('pt-BR')}</p>
                  ${
                    task.location &&
                    typeof task.location.latitude === 'number' &&
                    typeof task.location.longitude === 'number'
                      ? `<p><span class="label">Localização:</span> ${formatarCoordenada(
                          task.location.latitude,
                        )}, ${formatarCoordenada(task.location.longitude)}</p>`
                      : ''
                  }
                </div>

                <div class="section">
                  <h2>Execução do serviço</h2>
                  <p><span class="label">O que foi feito:</span></p>
                  <p>${whatWasDone || '-'}</p>
                </div>

                <div class="section">
                  <h2>Assinaturas</h2>
                  <div class="signatures-row">
                    <div class="signature-col">
                      <p><span class="label">Técnico:</span> ${technicianSignature || '-'}</p>
                      <div class="signature-box">
                        ${technicianSignatureSvg || ''}
                      </div>
                    </div>
                    <div class="signature-col">
                      <p><span class="label">Cliente:</span> ${clientSignature || '-'}</p>
                      <div class="signature-box">
                        ${clientSignatureSvg || ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bottom-half">
                <h2>Fotos</h2>
                <div class="photos-row">
                  ${photosHtml}
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Relatório da tarefa',
        });
      } else {
        Alert.alert('PDF gerado', `O PDF foi gerado em: ${uri}`);
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível gerar o PDF da tarefa.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleTechnicianSignatureStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setTechnicianSignaturePoints((current) => {
      const nextStrokeId =
        current.length > 0 ? current[current.length - 1].strokeId + 1 : 1;
      const newPoint: PontoAssinatura = { x: locationX, y: locationY, strokeId: nextStrokeId };
      return [...current, newPoint];
    });
  };

  const handleTechnicianSignatureMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setTechnicianSignaturePoints((current) => {
      if (current.length === 0) {
        const firstPoint: PontoAssinatura = { x: locationX, y: locationY, strokeId: 1 };
        return [firstPoint];
      }
      const lastStrokeId = current[current.length - 1].strokeId;
      const newPoint: PontoAssinatura = { x: locationX, y: locationY, strokeId: lastStrokeId };
      return [...current, newPoint];
    });
  };

  const handleTechnicianSignatureEnd = () => {};

  const handleClientSignatureStart = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setClientSignaturePoints((current) => {
      const nextStrokeId =
        current.length > 0 ? current[current.length - 1].strokeId + 1 : 1;
      const newPoint: PontoAssinatura = { x: locationX, y: locationY, strokeId: nextStrokeId };
      return [...current, newPoint];
    });
  };

  const handleClientSignatureMove = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setClientSignaturePoints((current) => {
      if (current.length === 0) {
        const firstPoint: PontoAssinatura = { x: locationX, y: locationY, strokeId: 1 };
        return [firstPoint];
      }
      const lastStrokeId = current[current.length - 1].strokeId;
      const newPoint: PontoAssinatura = { x: locationX, y: locationY, strokeId: lastStrokeId };
      return [...current, newPoint];
    });
  };

  const handleClientSignatureEnd = () => {};

  const handleClearTechnicianSignaturePoints = () => {
    setTechnicianSignaturePoints([]);
  };

  const handleClearClientSignaturePoints = () => {
    setClientSignaturePoints([]);
  };

  const openSignatureModal = (role: 'technician' | 'client') => {
    setActiveSignature(role);
    setSignatureModalVisible(true);
  };

  const closeSignatureModal = () => {
    setSignatureModalVisible(false);
  };

  const closePhotoModal = () => {
    setPhotoModalVisible(false);
    setActivePhotoIndex(null);
  };

  const handleGoToMain = () => {
    router.replace('/(tabs)');
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
                {`Localização: ${formatarCoordenada(task.location.latitude)}, ${formatarCoordenada(
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
            {photos.map((uri, index) => (
              <TouchableOpacity
                key={uri}
                onPress={() => handlePhotoPress(index)}
              >
                <Image source={{ uri }} style={styles.photo} />
              </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.signatureOpenButton}
            onPress={() => openSignatureModal('technician')}
          >
            <ThemedText style={styles.signatureOpenButtonText}>
              Assinar
            </ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.label}>Assinatura do cliente</ThemedText>
          <TextInput
            style={styles.input}
            value={clientSignature}
            onChangeText={setClientSignature}
            placeholder="Nome completo do cliente"
          />
          <TouchableOpacity
            style={styles.signatureOpenButton}
            onPress={() => openSignatureModal('client')}
          >
            <ThemedText style={styles.signatureOpenButtonText}>
              Assinar
            </ThemedText>
          </TouchableOpacity>
        </View>

        <Modal
          transparent
          visible={signatureModalVisible}
          animationType="slide"
          onRequestClose={closeSignatureModal}
        >
          <View style={styles.signatureModalBackdrop}>
            <View style={styles.signatureModalContent}>
              <ThemedText type="subtitle" style={styles.signatureModalTitle}>
                {activeSignature === 'technician'
                  ? 'Assinatura do técnico'
                  : activeSignature === 'client'
                  ? 'Assinatura do cliente'
                  : 'Assinatura'}
              </ThemedText>

              {activeSignature === 'technician' && (
                <View
                  style={styles.signaturePad}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleTechnicianSignatureStart}
                  onResponderMove={handleTechnicianSignatureMove}
                  onResponderRelease={handleTechnicianSignatureEnd}
                  onResponderTerminate={handleTechnicianSignatureEnd}
                >
                  {technicianSignaturePoints.map((point, index) => (
                    <View
                      key={`tech-${index}`}
                      style={[
                        styles.signatureDot,
                        { left: point.x, top: point.y },
                      ]}
                    />
                  ))}
                </View>
              )}

              {activeSignature === 'client' && (
                <View
                  style={styles.signaturePad}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleClientSignatureStart}
                  onResponderMove={handleClientSignatureMove}
                  onResponderRelease={handleClientSignatureEnd}
                  onResponderTerminate={handleClientSignatureEnd}
                >
                  {clientSignaturePoints.map((point, index) => (
                    <View
                      key={`client-${index}`}
                      style={[
                        styles.signatureDot,
                        { left: point.x, top: point.y },
                      ]}
                    />
                  ))}
                </View>
              )}

              <View style={styles.signatureModalButtonsRow}>
                {activeSignature === 'technician' && (
                  <TouchableOpacity
                    style={styles.signatureClearButton}
                    onPress={handleClearTechnicianSignaturePoints}
                  >
                    <ThemedText style={styles.signatureClearButtonText}>
                      Limpar
                    </ThemedText>
                  </TouchableOpacity>
                )}
                {activeSignature === 'client' && (
                  <TouchableOpacity
                    style={styles.signatureClearButton}
                    onPress={handleClearClientSignaturePoints}
                  >
                    <ThemedText style={styles.signatureClearButtonText}>
                      Limpar
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.signatureModalCloseButton}
                  onPress={closeSignatureModal}
                >
                  <ThemedText style={styles.signatureModalCloseButtonText}>
                    Concluir
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={photoModalVisible}
          animationType="fade"
          onRequestClose={closePhotoModal}
        >
          <View style={styles.photoModalBackdrop}>
            <View style={styles.photoModalContent}>
              {activePhotoIndex !== null && photos[activePhotoIndex] && (
                <Image
                  source={{ uri: photos[activePhotoIndex] }}
                  style={styles.photoModalImage}
                />
              )}
              <TouchableOpacity
                style={styles.photoModalCloseButton}
                onPress={closePhotoModal}
              >
                <ThemedText style={styles.photoModalCloseButtonText}>
                  Fechar
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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

          {isDone && (
            <TouchableOpacity
              style={styles.pdfButton}
              onPress={handleGeneratePdf}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <ActivityIndicator color="white" />
              ) : (
                <ThemedText type="defaultSemiBold" style={styles.pdfButtonText}>
                  Compartilhar PDF
                </ThemedText>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.goMainButton} onPress={handleGoToMain}>
            <ThemedText type="defaultSemiBold" style={styles.goMainButtonText}>
              Cancelar
            </ThemedText>
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
  pdfButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
  },
  pdfButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  goMainButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#6b7280',
  },
  goMainButtonText: {
    color: '#ffffff',
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
  signaturePad: {
    marginTop: 8,
    height: 200,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
  },
  signatureDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  signatureClearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  signatureClearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  signatureModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureModalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  signatureModalTitle: {
    marginBottom: 12,
  },
  signatureModalButtonsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signatureModalCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0a7ea4',
  },
  signatureModalCloseButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  signatureOpenButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  signatureOpenButtonText: {
    fontWeight: '600',
    color: '#111827',
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  photoModalImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
  },
  photoModalCloseButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  photoModalCloseButtonText: {
    fontWeight: '600',
    color: '#111827',
  },
});
