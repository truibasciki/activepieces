# Funcionalidades Removidas da CE — Análise e Roadmap

Este documento lista todas as funcionalidades Enterprise Edition (EE) removidas neste branch, o que cada uma fazia, e o que seria necessário para reimplementá-las na Community Edition.

---

## 1. Colaboração em Equipe

### Membros de Projeto

**O que fazia:** Convidava usuários para um projeto por e-mail. Cada membro tinha um papel (Admin/Editor/Visualizador). A lista de membros aparecia na tabela de fluxos e nas configurações do projeto.

**O que foi removido:**
- Tabela `ProjectMemberEntity`
- Endpoints CRUD de membros
- O `change-owner-dialog` ainda existe, mas a lista de membros está sempre vazia

**Para reimplementar:**
- Restaurar `ProjectMemberEntity` em `getEntities()`
- Restaurar endpoints: `GET/POST/PATCH/DELETE /v1/project-members`
- Implementar `projectMemberHooks.upsert()` para gravar na tabela
- Reconectar a lista de membros no `ChangeOwnerDialog` e no painel de configurações

**Esforço:** Médio — o modelo de dados é simples. O principal trabalho é restaurar os endpoints e reconectar o frontend.

---

### Papéis Personalizados (RBAC por Projeto)

**O que fazia:** Admins de plataforma podiam definir papéis personalizados além de Admin/Editor/Visualizador, com subconjuntos específicos de permissões. Por exemplo, um papel "Analista Somente Leitura" com apenas `READ_FLOW` e `READ_RUN`.

**O que foi removido:**
- CRUD de papéis personalizados
- `projectRoleHooks.getOneOrThrowById()` lança "não disponível nesta edição"

**Para reimplementar:**
- `ProjectRoleEntity` ainda está registrada na CE — a tabela já existe
- Restaurar endpoints: `GET/POST/PATCH/DELETE /v1/project-roles`
- Implementar `projectRoleHooks.getOneOrThrowById()` para consultar a tabela
- Adicionar middleware de RBAC (pode ser mais simples que a versão EE — apenas verificar `member.role.permissions` antes de cada ação)
- Restaurar a UI de papéis no painel de administração

**Esforço:** Médio-Alto — a CE já tem a entidade e o enum `Permission`. O trabalho está no middleware e na UI.

---

## 2. Autenticação

### Chaves de API (API Keys)

**O que fazia:** Admins de plataforma geravam tokens de longa duração (não sessões de usuário) para acesso programático. A chave era exibida uma vez e armazenada como hash SHA256. O middleware de autenticação aceitava `Bearer <api-key>` em qualquer endpoint.

**O que foi removido:**
- `ApiKeyEntity`
- Endpoints de geração de chaves
- Verificação no middleware de autenticação para reconhecer o principal como API Key

**Para reimplementar:**
- Criar `ApiKeyEntity` (id, platformId, displayName, hashedValue, truncatedValue)
- Adicionar endpoints `GET/POST/DELETE /v1/api-keys` (escopados por plataforma)
- No `authentication-service.ts`, adicionar caminho de lookup: se o header for `Bearer <token-longo>`, calcular SHA256 e consultar a tabela
- Frontend: restaurar a página de API Keys em Admin da Plataforma → Segurança

**Esforço:** Baixo-Médio — funcionalidade autocontida, sem dependências externas.

---

### OTP por E-mail / Esqueci a Senha

**O que fazia:** Quando um usuário clicava em "Esqueci minha senha", um e-mail era enviado com um código de 6 dígitos válido por 10 minutos. Após confirmar o código, o usuário podia definir uma nova senha.

**O que foi removido:**
- `OtpEntity`
- Serviço de OTP
- Componentes de formulário de redefinição de senha
- `emailServiceHooks.sendInvitation`

**Para reimplementar:**
- Requer serviço de e-mail SMTP funcionando primeiro (ver abaixo)
- Criar `OtpEntity` (identityId, type, value, state, expiresAt)
- Adicionar `POST /v1/otp` (criar/enviar) e `POST /v1/otp/confirm` (verificar)
- Restaurar componente `ResetPasswordForm` no frontend
- Conectar `emailServiceHooks` para enviar o código

**Esforço:** Médio — depende da infraestrutura de e-mail. A lógica do OTP em si é direta.

---

### Autenticação Federada (Google / GitHub OAuth SSO)

**O que fazia:** Login com Google ou GitHub. A plataforma podia restringir o login a domínios específicos. `federatedAuthnHooks.getThirdPartyRedirectUrl()` retornava a URL de redirecionamento OAuth.

**O que foi removido:**
- A lógica OAuth que gerava a URL de redirecionamento e tratava o callback

**Para reimplementar:**
- Adicionar cliente OAuth2 (ex.: `passport-google-oauth20`) para cada provedor
- Implementar `federatedAuthnHooks.getThirdPartyRedirectUrl()` para retornar a URL do provedor
- Adicionar endpoint de callback que troca o code pelo perfil do usuário → upsert do usuário → retorna token de sessão
- Adicionar configuração do provedor nas configurações da plataforma

**Esforço:** Médio — padrão OAuth2 bem documentado para Google e GitHub.

---

### SAML SSO

**O que fazia:** SSO de nível empresarial. Admins forneciam metadados XML do IDP. Usuários de um domínio configurado eram redirecionados ao IDP. No callback da assertion, o usuário era provisionado automaticamente.

**O que foi removido:**
- Inicialização do cliente SAML
- Endpoint ACS (`POST /v1/authn/saml/acs`)
- Verificação de domínio via DNS TXT records

**Para reimplementar:**
- Adicionar biblioteca `samlify` ou `passport-saml`
- Adicionar endpoint `POST /v1/authn/saml/acs`
- Armazenar metadados do IDP no registro de Plataforma
- Verificação DNS do domínio (verificar TXT record que o admin adiciona ao seu domínio)
- Auto-provisionar usuários na primeira assertion

**Esforço:** Alto — SAML tem muitos casos extremos (assertions assinadas, assertions criptografadas, clock skew, fluxos iniciados pelo IDP). Recomenda-se usar uma biblioteca consolidada.

---

## 3. Notificações

### Serviço de E-mail (SMTP)

**O que fazia:** Enviava e-mails HTML para convites, notificações de membro adicionado, códigos OTP e alertas de falha de fluxo. `emailSenderHooks.isSmtpConfigured()` já está fiada na CE — a implementação está apenas faltando.

**O que foi removido:**
- Implementação do sender SMTP
- Renderizador de templates de e-mail HTML
- Override de `emailServiceHooks` com a implementação real

**Para reimplementar:**
- Adicionar `nodemailer` em `packages/server/api`
- Override de `emailSenderHooks` e `emailServiceHooks` em `app.ts` com implementação SMTP real
- Configurar via variáveis de ambiente `SMTP_*` existentes (as props já existem em `AppSystemProp`)
- Templates HTML para: convite, membro adicionado, falha de fluxo

**Esforço:** Baixo-Médio — os hooks e as variáveis de ambiente já estão no lugar. Principalmente adicionar `nodemailer` e templates HTML. Isso desbloqueia OTP e Alertas também.

---

### Alertas de Falha de Fluxo

**O que fazia:** Usuários assinavam alertas de e-mail/webhook para falhas de fluxo por projeto. Se um fluxo falhasse, recebian um e-mail com nome do step, erro e URL da execução. Havia um limite diário de 50 alertas.

**O que foi removido:**
- `AlertEntity`
- Endpoints CRUD de alertas
- O hook de flow-run que verificava assinantes de alerta e enviava e-mails

**Para reimplementar:**
- Requer serviço de e-mail primeiro
- Criar `AlertEntity` (projectId, channel, receiver)
- Adicionar endpoints CRUD de alertas
- Em `flow-run-hooks.ts`, após uma execução terminar com status `FAILED`, consultar assinaturas de alerta do projeto e disparar e-mails
- Adicionar contador Redis para limite de frequência diário
- Restaurar painel de configurações de alertas nas configurações do projeto

**Esforço:** Médio — depende do serviço de e-mail. A lógica de disparo (na falha da execução) é direta.

---

## 4. Governança e Conformidade

### Logs de Auditoria

**O que fazia:** Cada ação do usuário (fluxo criado/atualizado/deletado, conexão criada, usuário logado, convite aceito, etc.) era gravada em uma linha de `AuditEventEntity`. Admins de plataforma podiam consultar e exportar o log.

**O que foi removido:**
- `AuditEventEntity`
- O serviço escritor de audit log
- A UI de tabela no painel admin

**Observação importante:** Os tipos `ApplicationEventName` e `ApplicationEvent` já foram recriados na CE (`events.ts`) porque o recurso de event-destinations precisa deles. O audit log é apenas uma camada de _persistência_ em cima desses mesmos eventos.

**Para reimplementar:**
- Criar `AuditEventEntity` com o schema de `ApplicationEvent`
- Em cada serviço que modifica recursos (flow service, connection service, etc.), emitir um `ApplicationEvent` após a operação
- Adicionar endpoint `GET /v1/audit-events` com filtros (usuário, ação, intervalo de datas)
- Restaurar a UI de Audit Log em Admin da Plataforma → Segurança

**Esforço:** Médio — os tipos de evento já estão definidos. O trabalho está nos pontos de inserção em cada serviço e no endpoint de consulta.

---

### Git Sync / Releases de Projeto

**O que fazia:** Vinculava um projeto a um repositório Git. Fluxos podiam ser publicados em um branch como JSON, e uma "release" aplicava uma versão tagueada de volta ao projeto. Usado para pipelines CI/CD e promoção de ambientes (dev → staging → prod).

**O que foi removido:**
- `GitRepoEntity`, `ProjectReleaseEntity`
- Serviço de git sync (usava `simple-git`)
- Toda a UI de releases e configuração de repositório

**Para reimplementar:**
- Adicionar dependência `simple-git`
- Criar `GitRepoEntity` (projectId, repoUrl, branch, credentials) e `ProjectReleaseEntity`
- Implementar pull (serializar todos os fluxos para JSON) e push (deserializar JSON para fluxos)
- Adicionar criptografia para credenciais git armazenadas
- Restaurar o painel de configurações de Git Sync e a UI de lista de releases

**Esforço:** Alto — serialização/deserialização de fluxos entre versões, criptografia de credenciais, tratamento de conflitos, mapeamento de variáveis de ambiente entre projetos.

---

## 5. Integrações e Extensibilidade

### OAuth2 Apps da Plataforma

**O que fazia:** Admins de plataforma registravam seus próprios client IDs e secrets OAuth2 para peças (ex.: seu próprio app Google OAuth em vez do padrão do Activepieces). Todos os usuários da plataforma usavam essas credenciais nos fluxos OAuth2.

**O que foi removido:**
- `OAuthAppEntity`
- O lookup que substituía credenciais da plataforma durante o redirect/callback OAuth2

**Para reimplementar:**
- Criar `OAuthAppEntity` (platformId, pieceName, clientId, clientSecret)
- No fluxo de conexão OAuth2, antes de construir a URL de redirect, verificar se existe um app OAuth2 a nível de plataforma para aquela peça e substituir as credenciais
- Adicionar página de OAuth Apps em Admin da Plataforma → Segurança

**Esforço:** Baixo-Médio — o fluxo OAuth2 já existe na CE. É apenas uma camada de substituição de credenciais antes de construir a URL de redirect.

---

### Conexões Globais (Nível de Plataforma)

**O que fazia:** Conexões criadas no escopo da plataforma eram acessíveis em todos os projetos sem precisar reinserir credenciais. Útil para integrações compartilhadas (ex.: um workspace do Slack usado por todas as equipes).

**O que foi removido:**
- API de conexão global
- O lookup que buscava conexões no escopo da plataforma quando não havia uma no escopo do projeto

**Para reimplementar:**
- Adicionar coluna `scope` em `AppConnectionEntity` com valores `PROJECT` / `PLATFORM`
- No resolver de conexões, ao buscar uma conexão para uma execução de fluxo, fazer fallback para escopo de plataforma se não houver correspondência no escopo do projeto
- Adicionar seção "Conexões Globais" na UI do Admin da Plataforma

**Esforço:** Médio — requer uma migration de schema e um lookup em dois níveis no serviço de conexão.

---

### Signing Keys

**O que fazia:** Admins de plataforma geravam pares de chaves RSA. A chave pública era fornecida aos clientes para verificar tokens JWT gerados pelo Activepieces (usado para autenticar iframes embutidos e chamadas de webhook).

**O que foi removido:**
- `SigningKeyEntity`
- Endpoints de geração de chaves

**Para reimplementar:**
- Criar `SigningKeyEntity` (platformId, displayName, publicKey, encryptedPrivateKey)
- Adicionar endpoints `GET/POST/DELETE /v1/signing-keys`
- As rotas de embed e fluxos de managed-auth que usam signing keys são recursos CE — se forem conectados, precisam desta tabela

**Esforço:** Baixo — geração de chave com `node:crypto`, endpoints CRUD simples.

---

### Subdomínios de Embed (Domínios Personalizados)

**O que fazia:** Provisionava hostnames personalizados (ex.: `flows.empresa.com.br`) para o builder embutido via API do Cloudflare. Quando uma requisição chegava naquele hostname, o servidor resolvia para a plataforma correta.

**O que foi removido:**
- `EmbedSubdomainEntity`
- Lógica de provisionamento no Cloudflare
- `embedSubdomainHooks.getByHostname()` retorna null na CE

**Para reimplementar sem Cloudflare:**
- Criar `EmbedSubdomainEntity` (platformId, hostname)
- Adicionar endpoints CRUD para admins registrarem um hostname manualmente
- Implementar `embedSubdomainHooks.getByHostname()` para consultar a tabela
- Configuração DNS é manual (cliente aponta o CNAME para o servidor Activepieces)
- Automação com Cloudflare pode ser adicionada depois como melhoria opcional

**Esforço:** Baixo (DNS manual) a Alto (Cloudflare automatizado). A resolução de hostname para plataforma é simples.

---

### Secret Managers (Vault / AWS / CyberArk)

**O que fazia:** Em vez de armazenar credenciais de conexão no banco de dados do Activepieces, elas eram buscadas em tempo de execução de um cofre externo. Cada conexão tinha um `secretId` apontando para uma entrada no cofre.

**O que foi removido:**
- `SecretManagerEntity`
- Interfaces dos adaptadores de cofre
- O hook que substituía a leitura do banco de dados pela chamada ao cofre

**Para reimplementar:**
- Definir interface `SecretManagerAdapter` (get, set, delete)
- Implementar adaptadores para HashiCorp Vault (HTTP API) e AWS Secrets Manager (AWS SDK)
- Criar `SecretManagerEntity` (platformId, type, configuration)
- Override do caminho de descriptografia de conexão para chamar o adaptador ao invés de ler a coluna do banco
- Adicionar UI de configuração no Admin da Plataforma

**Esforço:** Alto — cada cofre tem um modelo de autenticação diferente (AppRole, IAM roles, certificados). Requer tratamento robusto de erros e lógica de fallback.

---

## 6. Billing / Marketplace

### Stripe Billing

**O que fazia:** Gerenciava planos de assinatura, limites de fluxos ativos, limites por projeto, recarga de créditos de IA e faturamento mensal via webhooks do Stripe.

**Relevância para CE:** Específico ao produto Activepieces Cloud. Não é geralmente útil para CE auto-hospedada.

**Recomendação:** Não reimplementar para CE. Se forem necessários limites de uso, implementar um sistema simples de cotas baseado em variáveis de ambiente ou arquivo de configuração local — sem dependência do Stripe.

---

### Integração AppSumo

**O que fazia:** Ativava licenças compradas através do marketplace AppSumo.

**Relevância para CE:** Apenas relevante para distribuição no AppSumo. Requer credenciais da API de vendor do AppSumo. Não é prioridade para CE.

---

## Ordem de Prioridade para Desenvolvimento CE

| Prioridade | Funcionalidade | Por quê | Esforço |
|---|---|---|---|
| 1 | Serviço de E-mail (SMTP) | Desbloqueia convites, OTP e alertas | Baixo-Médio |
| 2 | Chaves de API (API Keys) | Mais solicitado para automação/CI | Baixo-Médio |
| 3 | Alertas de Falha de Fluxo | Necessidade operacional central | Médio |
| 4 | Membros de Projeto | Colaboração em equipe | Médio |
| 5 | OAuth2 Apps da Plataforma | Reduz reinserção de credenciais | Baixo-Médio |
| 6 | Logs de Auditoria | Conformidade, tipos já definidos | Médio |
| 7 | Autenticação Federada (Google/GitHub) | Necessidade comum em auto-hospedagem | Médio |
| 8 | Papéis Personalizados de Projeto | Entidade já existe na CE | Médio-Alto |
| 9 | Conexões Globais | Organizações com múltiplos projetos | Médio |
| 10 | Git Sync | Fluxos de trabalho DevOps | Alto |
| 11 | SAML SSO | Requisito empresarial | Alto |
| 12 | Secret Managers | Ambientes regulados | Alto |

As 3 primeiras (SMTP → API Keys → Alertas) formam um primeiro marco natural, onde cada uma constrói sobre a anterior sem depender de serviços externos.
