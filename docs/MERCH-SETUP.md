# Mise en place du merch (variantes, e-mails, paiement en ligne)

Tout est livré **désactivé par défaut** : le public ne voit rien tant que `js/config.js` contient
`features.merch: false` et `features.onlinePayment: false`.

## 1. Base de données (obligatoire)
Dans Supabase > SQL Editor, exécuter dans cet ordre (une fois chacun) :
1. `supabase/migration-merch.sql`
2. `supabase/migration-merch-v2.sql`

Ensuite, dans l'admin : Merch (produits, variantes, badges), Commandes, QR code.
Le **stock baisse automatiquement** quand une commande devient « Payée » ou « Confirmée », et **remonte** si elle est annulée.

## 2. E-mails automatiques (Resend)
1. Créer un compte sur resend.com et une clé API.
2. **Important :** sans domaine vérifié, Resend ne peut envoyer qu'à ta propre adresse. Pour écrire aux **clients**, il faut un
   nom de domaine à toi (ex. joey-tribute.fr, quelques euros par an) vérifié dans Resend. Une adresse Gmail ne peut pas servir d'expéditeur.
3. Installer la CLI Supabase (`npm i -g supabase`), puis dans le dossier du site :
```
supabase login
supabase link --project-ref elcdvzokmhunvhqwtaod
supabase secrets set RESEND_API_KEY=... MAIL_FROM="Joɘy <contact@ton-domaine.fr>" ADMIN_EMAIL=joeybfmv.contact@gmail.com \
  SITE_URL=https://TON-SITE/ SITE_ORIGIN=https://TON-UTILISATEUR.github.io NOTIFY_SECRET=une-longue-phrase-secrete
supabase functions deploy notify --no-verify-jwt
```
4. Supabase > Database > Webhooks > Create : table `merch_orders`, évènement **Insert**, type « Supabase Edge Functions »
   (ou HTTP) vers la fonction `notify`, avec l'en-tête `x-webhook-secret` = ta phrase secrète. Refaire pour la table `contact_requests`.
   → À chaque demande de concert ou commande : tu reçois un e-mail, et le client reçoit sa confirmation.

## 3. Paiement en ligne (Stripe) — optionnel
**Avant tout :** un compte Stripe exige d'être **majeur** (18 ans) ; il doit être ouvert par un parent / représentant légal
(ou toi à 18 ans), avec son identité et son IBAN. Il faut aussi des **CGV**, des mentions légales complètes et l'information
sur le droit de rétractation (vente à distance) avant d'ouvrir la vente en ligne.

1. Créer le compte Stripe, rester en **mode test** (cartes de test 4242 4242 4242 4242).
2. Déployer les fonctions :
```
supabase secrets set STRIPE_SECRET_KEY=sk_test_... 
supabase functions deploy merch-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```
3. Stripe > Développeurs > Webhooks > ajouter l'endpoint
   `https://elcdvzokmhunvhqwtaod.supabase.co/functions/v1/stripe-webhook` avec les évènements
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`.
   Copier le « secret de signature » : `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
4. Passer `features.onlinePayment` à `true` dans `js/config.js`, tester une commande en mode test.
5. Seulement ensuite : clés live (`sk_live_...`) et nouveau webhook live.

Les prix sont toujours relus dans la base côté serveur : le navigateur ne peut pas les modifier.
Un remboursement se fait dans Stripe (le bouton « Annuler » de l'admin remet seulement le stock).

## 4. Ouvrir la boutique
Exécuter `supabase/migration-settings.sql`, puis, dans l'admin > Merch, cocher « Boutique visible sur le site ». Aucun fichier à modifier : décocher referme la boutique immédiatement (onglet masqué, produits et commandes inaccessibles).
