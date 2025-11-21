import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Aviso</ThemedText>
      <ThemedText style={styles.message}>
        Esta é uma tela modal genérica do aplicativo. Você pode usá-la para exibir avisos ou
        informações rápidas para o usuário.
      </ThemedText>
      <Link href="/" style={styles.link}>
        <ThemedText type="link">Fechar</ThemedText>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  message: {
    marginTop: 12,
    textAlign: 'center',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
