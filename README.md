
# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

   Depois, escolha rodar em:

   - Expo Go (leia o QR Code)
   - Emulador Android / iOS
   - Navegador Web

---

## Funcionalidades principais

- **Login / Cadastro** com Firebase Authentication.
- **Criação de tarefas** por data, com nome do cliente e descrição do serviço.
- **Menu principal** com visão de tarefas pendentes e concluídas.
- **Registro de localização** (geolocalização) na criação da tarefa.
- **Detalhe da tarefa** com:
  - campo "o que foi feito";
  - fotos da execução (câmera ou galeria), armazenadas como base64;
  - assinaturas do técnico e do cliente desenhadas na tela.
- **Geração de relatório em PDF**, incluindo:
  - dados da tarefa;
  - descrição do serviço;
  - fotos com data, hora e localização;
  - assinaturas em formato gráfico.
- **Compartilhamento do PDF** (por exemplo, via WhatsApp).

---

## Tecnologias

- **Expo / React Native**
- **Expo Router** para navegação
- **Firebase Authentication** para login/cadastro
- **Cloud Firestore** para armazenamento das tarefas
- **expo-location** para GPS
- **expo-image-picker** / **expo-image** para fotos
- **expo-print** + **expo-sharing** para geração e envio de PDF
- **expo-calendar** para criação opcional de evento no calendário do dispositivo

---

## Scripts úteis

- `npm start` ou `npx expo start` – inicia o servidor de desenvolvimento.
- `npm run android` – inicia no emulador/dispositivo Android.
- `npm run ios` – inicia no simulador iOS (em macOS).
- `npm run web` – roda no navegador.
