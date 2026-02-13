# 🚀 Auth API (LDAP Integration)

Esta API fornece serviços de autenticação centralizada integrada ao diretório LDAP/Active Directory, permitindo validação de credenciais, verificação de grupos de segurança e geração de relatórios de auditoria.

## ✨ Funcionalidades

* **Autenticação Tripla**: Validação de usuário, senha e pertencimento a um grupo específico.
* **Emissão de JWT**: Geração de tokens assinados para sessões seguras.
* **Relatórios de Auditoria**: Consulta de usuários inativos no domínio (requer privilégios de administrador).
* **Sanitização de Dados**: Proteção ativa contra ataques de LDAP Injection.

## 🛠️ Tecnologias Utilizadas

* **Runtime**: Node.js 20 (Alpine).
* **Framework**: Fastify v5.
* **Linguagem**: TypeScript.
* **Validação**: Zod para esquemas de dados e variáveis de ambiente.

---

## ⚙️ Configuração

A API é configurada via variáveis de ambiente. Crie um arquivo `.env` na raiz do projeto:

| Variável | Descrição | Exemplo |
| --- | --- | --- |
| `LDAP_URL` | URL do servidor LDAP/AD | `ldap://192.168.1.10:389` |
| `LDAP_BASE_DN` | Base de busca do domínio | `dc=solucoes,dc=com,dc=br` |
| `LDAP_BIND_USER` | Usuário de serviço para bind | `cn=admin,ou=services,dc=solucoes...` |
| `LDAP_BIND_PASSWORD` | Senha do usuário de serviço | `senha_secreta` |
| `JWT_SECRET` | Chave secreta para JWT (mín. 32 chars) | `sua_chave_muito_longa_e_segura_aqui` |
| `PORT` | Porta de execução da API | `3001` |

---

## 🛡️ Camadas de Segurança Implementadas

A API utiliza múltiplos plugins para garantir a integridade dos dados e do serviço:

1. **Fastify Helmet**: Configura cabeçalhos HTTP de segurança para evitar ataques como XSS e Clickjacking.
2. **Fastify Rate Limit**: Proteção contra ataques de força bruta, limitando a 10 requisições por minuto por IP.
3. **Fastify CORS**: Restrição de origens permitidas para consumo da API.
4. **Non-Root User**: O container Docker executa com o usuário `node` (sem privilégios de root) para mitigar riscos de escalonamento.

---

## 📡 Endpoints

### 1. Autenticação (Login)

Valida credenciais e pertencimento a um grupo.

* **URL**: `/login`
* **Método**: `POST`
* **Corpo da Requisição**:
```json
{
  "username": "guilherme.machado",
  "password": "sua_senha_ldap",
  "group": "VPN_Users"
}
```


* **Resposta (Sucesso 200)**: Retorna um token JWT válido por 8 horas e dados básicos do usuário.

### 2. Relatório de Usuários Inativos

Gera uma lista de usuários que não logaram no prazo informado.

* **URL**: `/lastLogon/report`
* **Método**: `POST`
* **Requisito**: O usuário solicitante deve pertencer ao grupo `Administrators` no LDAP.
* **Corpo da Requisição**:
```json
{
  "username": "admin_user",
  "password": "senha_admin",
  "days": 30
}
```


* **Resposta (Sucesso 200)**: Retorna a lista de usuários, e-mails e a data do último logon.

---

## 🐳 Execução com Docker

O projeto está configurado para deploy imediato via Docker.

### Comandos Principais:

* **Subir ambiente**:
```bash
docker-compose up -d --build
```


* **Desenvolvimento local**:
```bash
npm install
npm run dev
```


* **Build de produção**:
```bash
npm run build
npm start
```

---

### 📊 Limites de Recursos (Docker Compose)

Para garantir estabilidade, o container possui os seguintes limites configurados:

* **CPU**: Máximo de 0.50 (50% de um núcleo).
* **Memória**: Máximo de 256MB RAM.

---

> Desenvolvido pelo time de tecnologia da informação