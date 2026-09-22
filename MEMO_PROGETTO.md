# 📌 MEMO PROGETTO: ALL STAR TEAM (Bowling Web App)

Questo documento riassume tutte le informazioni essenziali per la gestione, lo sviluppo, il database e l'accesso all'applicazione.

---

## 1. 🌐 Repository GitHub
- **Repository Principale (Produzione & Vercel)**:  
  👉 [https://github.com/nesple69/all-star-bowling-web](https://github.com/nesple69/all-star-bowling-web)
- **Branch di produzione**: `main`  
  *(Ogni push su `main` avvia il deploy automatico su Vercel)*
- **Repository secondaria (Mirror)**:  
  [https://github.com/nesple69/bowling-all-star](https://github.com/nesple69/bowling-all-star)

---

## 2. 🗄️ Database
- **Provider**: **Supabase** (PostgreSQL ospitato su AWS Cloud - EU West 3 / Parigi)
- **Progetto Supabase ID**: `fpktboiyitwmwodwxuki`
- **Dashboard Web Supabase**: [https://supabase.com/dashboard/project/fpktboiyitwmwodwxuki](https://supabase.com/dashboard/project/fpktboiyitwmwodwxuki)
- **ORM / Gestione Schema**: **Prisma ORM** (`server/prisma/schema.prisma`)
- **Stringhe di Connessione (da `.env`)**:
  - **Connection Pooling (PgBouncer porta 6543)**:  
    `postgresql://postgres.fpktboiyitwmwodwxuki:AllStarTeam2026%21@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
  - **Direct Connection (porta 5432 - per migrazioni Prisma)**:  
    `postgresql://postgres.fpktboiyitwmwodwxuki:AllStarTeam2026%21@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`

---

## 3. 🔑 Credenziali di Accesso

### 👑 Accesso Amministratore (Pannello Web / Gestione)
- **Username**: `Nedo`
- **Email**: `nesple@gmail.com`
- **Password**: `admin` *(oppure la password personalizzata impostata dal pannello profilo)*
- **Ruolo**: `ADMIN` (accesso completo a Tornei, Import Dati, Contabilità, Gestione Utenti)

---

## 4. 🚀 Comandi Utili per lo Sviluppo Locale
Se esegui il progetto in locale dal tuo PC:
- **Avvio ambiente di sviluppo (Frontend + Backend)**:  
  ```bash
  npm run dev
  ```
- **Compilazione build di produzione**:  
  ```bash
  npm run build
  ```
- **Aggiornamento Schema Prisma**:  
  ```bash
  cd server && npx prisma db push
  ```
- **Invio modifiche online su GitHub e Vercel**:  
  ```bash
  git add .
  git commit -m "Descrizione modifiche"
  git push origin main
  ```
