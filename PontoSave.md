# PontoSave – Projeto App de Gerenciamento de Tarefas em Campo

## 1. Descrição Geral do Projeto

O projeto é um **aplicativo móvel em React Native (Expo)** para **gestão de tarefas de equipes de campo**.
Ele permite que um técnico faça login, visualize suas tarefas do dia em uma lista integrada a um calendário, crie novas tarefas com localização, registre o que foi realizado, tire fotos e colete assinaturas para encerramento da atividade.

O backend de autenticação e dados é feito com **Firebase Authentication** e **Cloud Firestore**.

---

## 2. Objetivos do Aplicativo

- **Controlar tarefas de atendimento em campo** (visitas a clientes, serviços, manutenções).
- **Registrar evidências do serviço** (descrição, fotos, assinaturas).
- **Facilitar o dia a dia do técnico**, oferecendo:
  - Lista de tarefas por data.
  - Visualização clara do status (pendente / concluída).
  - Localização do cliente no momento da criação da tarefa.
- **Garantir rastreabilidade**, armazenando os dados em nuvem (Firestore).

---

## 3. Funcionalidades Implementadas

- **Autenticação (Login/Cadastro)**  
  - Login e cadastro de usuário via **Firebase Auth (email e senha)**.  
  - Redirecionamento automático para a tela de tarefas após autenticação bem-sucedida.
  - Exibição do **email do usuário logado** na tela de tarefas.

- **Tela de Lista de Tarefas (Home)**  
  - Listagem das tarefas filtradas por **data selecionada**.  
  - Botão **“Data”** que abre um modal de calendário para escolher o dia.  
  - Botão **“Nova Tarefa”** que navega para a tela de criação de tarefa.  
  - Botão **“Sair”** que faz `signOut` no Firebase e volta para a tela de login.  

- **Criação de Nova Tarefa** (`/task/new`)  
  - Campos obrigatórios:
    - Nome do cliente.
    - Descrição / O que deve ser feito.
    - Localização (capturada via GPS pelo aparelho).  
  - Validação:
    - Se Nome, Descrição ou Localização estiverem vazios, o app mostra uma **mensagem de erro** e não permite salvar.
  - Salvamento no **Firestore**, associando a tarefa ao usuário autenticado e à data selecionada.

- **Tela de Detalhes da Tarefa** (`/task/[id]`)  
  - Exibe as informações básicas da tarefa (cliente, descrição, data, localização).  
  - Permite registrar:
    - O que foi feito.
    - Até **2 fotos** da execução (armazenadas como **base64** no Firestore, sem usar Firebase Storage).  
    - Assinatura do técnico.
    - Assinatura do cliente.
  - Possibilidade de **marcar a tarefa como concluída**.
  - Botão **“Excluir tarefa”**:
    - Abre um `Alert` pedindo confirmação.
    - Em caso de confirmação, remove o documento no Firestore e retorna à lista.

---

## 4. Arquitetura e Tecnologias Utilizadas

- **Frontend / Mobile**
  - **React Native** com **Expo**.
  - Linguagem: **TypeScript**.
  - Navegação: **Expo Router** (arquitetura por pastas em `app/`).
  - Bibliotecas Expo:
    - `expo-location` – captura de localização atual.
    - `expo-image-picker` – seleção/captura de imagens (fotos da tarefa).

- **Backend (BaaS)**
  - **Firebase**
    - `firebase/app` – inicialização.
    - `firebase/auth` – autenticação de usuários.
    - `firebase/firestore` – banco de dados em nuvem para tarefas.
  - Configuração centralizada em `firebaseConfig.ts`, exportando `auth` e `db`.

- **Estrutura de Pastas Importante**
  - `app/index.tsx` – Tela de Login/Cadastro.
  - `app/(tabs)/index.tsx` – Tela principal de lista de tarefas + calendário + logout.
  - `app/task/new.tsx` – Tela de criação de nova tarefa.
  - `app/task/[id].tsx` – Tela de detalhes/encerramento/exclusão da tarefa.
  - `firebaseConfig.ts` – Configuração do Firebase (Auth e Firestore).

---

## 5. Fluxo Principal de Uso

1. Usuário abre o app e faz **login ou cadastro**.  
2. Após autenticação, é redirecionado para a **tela de tarefas do dia**.  
3. Pode:
   - Alterar a **data** pelo botão “Data”.
   - Criar uma **Nova Tarefa**, preenchendo os campos obrigatórios e salvando no Firestore.
4. Ao executar o serviço, abre a tarefa:
   - Registra o que foi feito.
   - Tira fotos (armazenadas em base64).
   - Coleta assinaturas.
   - Marca a tarefa como concluída.
5. Se necessário, pode **excluir** uma tarefa com confirmação.  
6. Ao finalizar o uso, utiliza o botão **“Sair”**, retornando à tela de login.

---

## 6. Possíveis Evoluções Futuras

- Mostrar tarefas em um **mapa**, com a localização de cada cliente.  
- Filtro por **status** (pendente, em andamento, concluída).  
- Envio de **relatório em PDF** por e‑mail com os dados da tarefa e as fotos.  
- Integração com **notificações push** para lembrar o técnico de tarefas agendadas.
