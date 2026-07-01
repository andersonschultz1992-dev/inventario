# Inventário de Hosts — ECER & DCPER

Aplicação web para consulta, gestão e análise do inventário de servidores de produção, substituindo a planilha Excel por um dashboard interativo com banco de dados Supabase.

**Stack:** HTML + CSS + JavaScript puro (ES Modules) · Supabase (PostgreSQL + Auth + RLS) · Chart.js · GitHub Pages. Sem build, sem framework, sem dependência de Node.

---

## Arquitetura

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  GitHub Pages (estático)    │        │  Supabase                    │
│  index.html + src/          │──────▶ │  PostgreSQL (hosts, lookups) │
│  supabase-js via CDN        │  HTTPS │  Auth (e-mail/senha)         │
│  Chart.js via CDN           │        │  RLS (segurança no banco)    │
└─────────────────────────────┘        └──────────────────────────────┘
```

- **Leitura pública**: qualquer visitante consulta o inventário (RLS `select using (true)`).
- **Escrita protegida**: apenas usuários autenticados com papel `editor` ou `admin` inserem/editam; **delete** somente `admin`. A segurança é garantida pelas políticas RLS no banco — a chave `anon` no frontend é pública por design.
- **Modo demo**: enquanto o Supabase não estiver configurado, a aplicação carrega `data/hosts.json` (dados extraídos da planilha) em modo somente leitura. Você pode publicar no GitHub Pages imediatamente.

### Modelo de dados

```
times ─┐
dominios ─┤
negocios ─┼──▶ hosts ◀──▶ host_tecnologias ◀── tecnologias
           │      │
           │      └── trigger atualizado_em
profiles (auth.users) — roles: viewer | editor | admin
hosts_view — view com joins prontos para o frontend
```

O relacionamento N:N `host_tecnologias` existe porque hosts reais da planilha têm múltiplas tecnologias (ex.: `Oracle_SOA, Oracle_BAM, Oracle_OSB`).

---

## Estrutura de pastas

```
├── index.html
├── data/
│   └── hosts.json              # dados para o modo demo (527 hosts)
├── database/
│   ├── schema.sql              # tabelas, índices, triggers, view, RLS
│   └── seed.sql                # carga inicial gerada da planilha
├── scripts/
│   └── import_xlsx.py          # regenera hosts.json + seed.sql da planilha
└── src/
    ├── app.js                  # orquestrador
    ├── config/supabase.js      # URL + anon key (preencher)
    ├── services/
    │   ├── api.js              # camada de dados (Supabase / demo)
    │   └── auth.js             # Supabase Auth + roles
    ├── components/
    │   ├── dashboard.js        # KPIs + gráficos
    │   ├── table.js            # tabela com ordenação/paginação
    │   ├── filters.js          # filtros e busca
    │   └── hostForm.js         # modal de cadastro/edição
    ├── styles/main.css         # identidade Sicredi
    └── utils/helpers.js        # CSV, EOL, debounce
```

---

## Rodando localmente

Como usa ES Modules, precisa de um servidor HTTP (não abrir via `file://`):

```bash
# opção 1
python3 -m http.server 8000
# opção 2
npx serve .
```

Acesse `http://localhost:8000`. Sem Supabase configurado, sobe em **modo demo** com os dados da planilha.

---

## Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (plano free atende).
2. No **SQL Editor**, execute `database/schema.sql` (uma vez).
3. Em seguida execute `database/seed.sql` (importa os 527 hosts da planilha).
4. Em **Settings → API**, copie a `Project URL` e a chave `anon public`.
5. Preencha `src/config/supabase.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```
6. Em **Authentication → Providers**, mantenha Email habilitado.
7. Crie sua conta pelo botão **Entrar → Criar conta** na aplicação (ou pelo painel do Supabase) e promova-se a admin no SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu@email.com';
   ```
8. Novos usuários nascem como `viewer` (somente leitura). Um admin libera edição:
   ```sql
   update public.profiles set role = 'editor' where email = 'colega@sicredi.com.br';
   ```

> **Segurança**: nunca commit a `service_role` key. A `anon` key pode ir para o repositório — todas as regras de escrita vivem nas políticas RLS do banco.

---

## Publicando no GitHub Pages

```bash
git init
git add .
git commit -m "Inventário de hosts — versão inicial"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/inventario-hosts.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**. Em ~1 minuto a aplicação estará em `https://SEU_USUARIO.github.io/inventario-hosts/`.

Não há etapa de build — todo push na `main` já publica.

---

## Reimportando a planilha

Se a planilha for atualizada e você quiser regerar os dados:

```bash
pip install pandas openpyxl
python scripts/import_xlsx.py "ECER_e_DCPER_-_Inventário_de_máquinas__produção_.xlsx"
```

O script regenera `data/hosts.json` (demo) e `database/seed.sql`. Para recarregar no Supabase em uma base já populada, o seed usa `on conflict do nothing` — hosts novos entram, existentes são preservados.

---

## Funcionalidades

- Dashboard com KPIs: total de hosts, ligados, domínios, tecnologias e **alertas de EOL** (RHEL ≤6/CentOS fora de suporte; RHEL 7 em ELS até 2029)
- Gráficos: hosts por tecnologia, por versão de SO, por família de SO, top domínios
- Filtros combináveis: time, tecnologia, domínio, versão SO, família SO, Java, situação + busca por hostname
- Tabela com ordenação por coluna, paginação e badges de risco EOL
- CRUD de hosts com validação (hostname único case-insensitive, formato validado)
- Cadastro implícito de domínio/negócio/tecnologia ao salvar um host (upsert por nome)
- Exportação do resultado filtrado em CSV (separador `;` + BOM, abre certo no Excel)
- Autenticação Supabase com papéis viewer/editor/admin

---

## Evolução futura

Ideias já suportadas pela arquitetura:

1. **Ambientes NPROD/HOM** — o campo `ambiente` já existe; basta importar as abas de não-produção.
2. **Tabela de EOL dinâmica** — mover as datas da aba "EOL RHEL" para uma tabela `eol_referencia` e calcular o risco no banco em vez de hardcode no frontend.
3. **Pontos de montagem** — nova tabela `pontos_montagem (host_id, servidor_remoto, compartilhamento, ponto_local, situacao)` replicando as abas de montagem.
4. **Histórico/auditoria** — tabela `hosts_historico` populada por trigger para rastrear quem alterou o quê (compliance).
5. **Coleta automática** — job (GitHub Actions ou Rundeck) que consulta Ansible/Satellite/Dynatrace e faz upsert via API do Supabase, eliminando atualização manual.
6. **Dashboards por time no Grafana** — o PostgreSQL do Supabase pode ser plugado como datasource direto no Grafana.
7. **SSO corporativo** — Supabase Auth suporta SAML/OIDC (Azure AD) nos planos pagos.
