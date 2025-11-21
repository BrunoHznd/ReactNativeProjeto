import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect } from 'expo-router';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '@/firebaseConfig';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.brandContainer}>
        <ThemedText type="title" style={styles.appTitle}>
          Controle de Tarefas de Equipe de Campo
        </ThemedText>
        <ThemedText style={styles.appSubtitle}>
          Gerencie as visitas e atividades da sua equipe de campo.
        </ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText type="subtitle" style={styles.authTitle}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={styles.label}>E-mail</ThemedText>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@empresa.com"
          />

          <ThemedText style={styles.label}>Senha</ThemedText>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Senha"
          />

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText type="defaultSemiBold" style={styles.buttonText}>
                {mode === 'login' ? 'Entrar' : 'Cadastrar'}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
            disabled={submitting}
          >
            <ThemedText type="link" style={styles.switchModeText}>
              {mode === 'login'
                ? 'Não tem conta? Cadastre-se'
                : 'Já tem conta? Faça login'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? { alignItems: 'center' } : {}),
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: {
    marginBottom: 24,
  },
  appTitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  appSubtitle: {
    textAlign: 'center',
    color: '#6b7280',
  },
  card: {
    width: '100%',
    ...(Platform.OS === 'web' ? { maxWidth: 420 } : {}),
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  authTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  form: {
    gap: 12,
  },
  label: {
    marginTop: 12,
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
  switchMode: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    textAlign: 'center',
  },
});
