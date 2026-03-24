# UniBrick Marketplace (Vue + Firebase)

Estrutura simplificada de marketplace para rodar em GitHub Pages com frontend em Vue e backend preparado para Firebase.

Este README foi escrito para quem nunca usou Firebase e quer configurar tudo no plano gratuito (Spark).

## O que ja esta implementado

- Busca de produtos por nome e filtros
- Pagina de produto
- Perfil do vendedor
- Login com Google (Firebase Auth quando configurado)
- Perfil pessoal (rota protegida)
- Cadastro de produto (rota protegida)
- Lista de produtos pessoais (rota protegida)
- Lista de favoritos (rota protegida)
- Edicao e exclusao de anuncios criados pelo usuario

Observacao importante:

- No estado atual, os dados de produtos e favoritos ainda usam armazenamento local para facilitar a base inicial.
- O login ja funciona com Firebase Auth quando as variaveis estao preenchidas.
- Mais abaixo ha um plano de migracao para Firestore.

## Parte 1: Criar projeto no Firebase (plano gratuito)

1. Acesse [Firebase Console](https://console.firebase.google.com).
2. Clique em Criar um projeto.
3. Nome sugerido: unibrick-marketplace.
4. Desative Google Analytics (opcional para este projeto, e simplifica).
5. Finalize.

Sobre custos:

- Escolha e mantenha o plano Spark (gratuito).
- Voce nao precisa cadastrar cartao para usar os recursos basicos que este projeto exige.

## Parte 2: Habilitar Authentication com Google

1. No menu do Firebase, abra Build > Authentication.
2. Clique em Comecar.
3. Aba Sign-in method.
4. Provedor Google > Enable.
5. Defina email de suporte e salve.

### Dominios autorizados (obrigatorio)

Em Authentication > Settings > Authorized domains, adicione:

- localhost
- 127.0.0.1
- seuusuario.github.io

Se seu site estiver em pagina de repositorio (exemplo: seuusuario.github.io/unibrick), manter o dominio seuusuario.github.io ja cobre.

## Parte 3: Registrar Web App e pegar configuracao

1. No topo da pagina do projeto Firebase, clique no icone Web (</>) para criar app web.
2. Nome: unibrick-web.
3. Nao precisa marcar Hosting para este caso (deploy esta no GitHub Pages).
4. Conclua.
5. Copie o objeto de configuracao mostrado (apiKey, authDomain, etc).

## Parte 4: Configurar variaveis no projeto local

1. Duplique o arquivo .env.example para .env
2. Preencha os campos com os dados do Firebase Web App.

Exemplo:

```env
VITE_BASE_PATH=/unibrick/
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Parte 5: Rodar localmente

1. Instale dependencias:

```bash
npm install
```

1. Rode:

```bash
npm run dev
```

1. Teste o fluxo:

- Abra a pagina de login.
- Clique Entrar com Google.
- Verifique se volta autenticado para o sistema.

Se as variaveis estiverem vazias, o app entra em modo demo local automaticamente.

## Parte 6: Publicar no GitHub Pages com Firebase Auth

O workflow de deploy ja existe em .github/workflows/deploy.yml.

No repositorio GitHub, configure os Secrets:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

Depois:

1. Push na branch main.
2. Em GitHub Settings > Pages, selecione GitHub Actions.
3. Aguarde o workflow concluir.

## Parte 7: Firestore (opcional agora, recomendado em seguida)

Para sair de localStorage e usar backend real:

1. Build > Firestore Database > Create database.
2. Modo: Production mode (recomendado).
3. Regiao: escolha a mais proxima dos usuarios.

### Estrutura inicial sugerida

- products (colecao)
  - title, description, category, condition
  - price
  - photos (array)
  - sellerId
  - createdAt, updatedAt
- users (colecao)
  - displayName, email, photoURL
  - createdAt
- favorites (subcolecao por usuario)
  - users/{uid}/favorites/{productId}

### Regras basicas sugeridas (inicial)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.sellerId == request.auth.uid;
      allow update, delete: if request.auth != null
        && resource.data.sellerId == request.auth.uid;
    }

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/favorites/{productId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Parte 8: Limites do plano gratuito (Spark)

Dicas praticas para nao ter surpresa:

- Evite loops de leitura sem necessidade.
- Use paginacao para listagens grandes.
- Evite salvar imagens no Firestore (use Firebase Storage para arquivos).
- Monitore uso no console do Firebase.

Para este projeto inicial, Spark costuma ser suficiente para estudo e MVP.

## Parte 9: Checklist rapido de validacao

- Login Google funcionando em localhost.
- Login Google funcionando no dominio do GitHub Pages.
- Redirecionamentos de rotas protegidas funcionando.
- CRUD local funcionando.
- Secrets configurados no GitHub.
- Deploy do Pages concluido com sucesso.

## Proximo passo recomendado de integracao

Migrar o arquivo src/services/marketplaceService.js para usar Firestore gradualmente:

1. Ler produtos do Firestore no lugar de getAllProducts local.
2. Criar produto no Firestore em createProduct.
3. Atualizar e excluir com updateDoc e deleteDoc.
4. Persistir favoritos em users/{uid}/favorites.

Assim voce consegue manter a interface atual e substituir apenas a camada de dados, sem refazer o frontend.
