# FactureFlash

Application de facturation pour petites entreprises, développée avec React, TanStack Start, Vite et Supabase Auth/PostgreSQL.

## Offre Pro

Le forfait Pro coûte **1 000 F CFA par mois**. Le checkout utilise FedaPay; la confirmation du paiement est vérifiée côté serveur avant l’activation du plan dans PostgreSQL.

## Développement local

1. Copier `.env.example` vers `.env` et renseigner les clés de Supabase Auth et FedaPay ainsi que l’URL PostgreSQL Supabase dans `DATABASE_URL`.
2. Appliquer [`supabase/migrations/20261023140000_initial_schema.sql`](supabase/migrations/20261023140000_initial_schema.sql) au projet Supabase. Il crée `businesses`, `business_profiles`, `clients`, `invoices`, `documents`, `quotes`, `invoice_items`, `subscriptions` et `invoice_sequences`; les comptes sont gérés par `auth.users` de Supabase. Le fichier [`factureflash.sql`](factureflash.sql) correspond à l’ancien schéma MySQL WAMP.
3. Installer les dépendances avec `npm install`.
4. Lancer `npm run dev` (Vite écoute sur le port 3004).

Les clés publiques `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et `VITE_FEDAPAY_PUBLIC_KEY` sont configurées dans l’environnement de build. `DATABASE_URL`, `DIRECT_URL` et `FEDAPAY_SECRET_KEY` sont des secrets serveur : ne leur ajoutez jamais le préfixe `VITE_`.

Google et GitHub sont des fournisseurs Supabase Auth. Activez-les dans les paramètres Auth du projet et autorisez les URL de retour `https://<votre-domaine>/auth/callback`. Le tableau de bord FactureFlash se trouve sur `/app`; les connexions OAuth aboutissent à cette route après le callback.
