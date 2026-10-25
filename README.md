# Joɘy — Tribute de Bullet for My Valentine (site officiel)

Site multi-pages en HTML/CSS/JavaScript natif (aucun framework, aucune étape de build), hébergeable sur **GitHub Pages**, avec **Supabase** pour les données dynamiques (concerts, setlist, matériel, demandes de contact) et l'authentification de l'administration.

> Projet tribute indépendant, non affilié à Bullet for My Valentine. Les pochettes de référence ne sont **pas** affichées sur le site (dossier ignoré par Git).

---

## 1. Direction artistique (issue des deux pochettes)

| Élément | Origine |
|---|---|
| Noir profond `#050405`, rouge sang `#b0121e` / `#d9192b`, blanc os `#ece6dc` | Pochette 1 : fond noir, rouge saturé, ornements blancs, éclaboussures |
| Grain photographique global, fumée, contrastes durs, images en niveaux de gris | Pochette 2 : noir & blanc, flammes/fumée, texture abîmée |
| Titres condensés en capitales + touches de serif gothique italique | Esprit des logos ornementés, sans les copier |
| Boutons à coins coupés, cadres décalés rouges | Langage « métal usé » original |

Tout est centralisé dans `css/variables.css`. L'image du hero (`assets/images/hero/hero-bg.svg`) est **originale** (fumée + éclaboussures générées) : remplacez-la par une vraie photo de scène dont vous détenez les droits.

---

## 2. Structure

```
index.html · concerts.html · setlist.html · materiel.html · contact.html · cgu.html · confidentialite.html
admin/        login.html · index.html · concerts.html · js/ · css/
css/          variables, reset, global, layout, components + 1 feuille par page
js/           config.js (réglages) · content.js (textes) · api.js (Supabase) · demo-data.js
              main/navigation/footer · home/concerts/setlist/materiel/contact · utils · concert-card
supabase/schema.sql
assets/       images/ icons/ fonts/
```

Chemins **relatifs** partout (compatible sous-répertoire GitHub Pages). Les modules JavaScript utilisent `import` : ouvrir les fichiers en double-cliquant (`file://`) ne fonctionne pas, utilisez un petit serveur local (section 7).

---

## 3. Ce que vous devez compléter

| Quoi | Où |
|---|---|
| Téléphone, e-mail, réseaux sociaux, liens Wayward Ship, lien officiel du groupe | `js/config.js` (valeurs « À COMPLÉTER » = non affichées comme vraies données) |
| Biographie, texte du tribute, présentation de Wayward Ship, membres | `js/content.js` (`placeholder: true` → passez à `false` quand le texte est définitif) |
| Photos (vous, groupe, Wayward Ship, guitares) | `assets/images/…` puis mettez à jour les chemins dans `js/content.js` / table `gear` |
| Mentions légales (identité de l'éditeur, hébergeur, durées de conservation, e-mail RGPD…) | `cgu.html` et `confidentialite.html` — passages surlignés **[À COMPLÉTER]** |
| Photo libre de droits de Bullet for My Valentine | `assets/images/band/` + `CONTENT.bfmv.photo` |

Vérifiez aussi que le lien `officialLinks.bfmvWebsite` pointe bien vers le site officiel actuel du groupe.

---

## 4. Créer et configurer Supabase

1. Créez un compte sur <https://supabase.com> puis **New project** (choisissez une région européenne, notez le mot de passe de la base).
2. **SQL Editor → New query** : collez tout `supabase/schema.sql` et cliquez **Run**. Il crée les tables `concerts`, `setlist`, `gear`, `contact_requests`, `admins`, les index, contraintes, politiques RLS, le limiteur anti-spam et le bucket `posters`.
3. **Project Settings → API** : copiez
   - **Project URL**
   - la clé **anon / publishable** (⚠️ **jamais** la clé `service_role`)

   puis collez-les dans `js/config.js` :
   ```js
   supabase: { url: "https://xxxx.supabase.co", anonKey: "eyJ…", posterBucket: "posters" }
   ```
   Ces deux valeurs sont publiques par conception : la sécurité repose sur les politiques RLS.
4. **Authentication → URL Configuration** : *Site URL* = `https://joeybfmv.github.io/WebSite/`.

### Premier compte administrateur

1. **Authentication → Users → Add user → Create new user** : votre e-mail + un mot de passe long ; cochez **Auto Confirm User**.
2. Dans le **SQL Editor**, déclarez ce compte comme administrateur (remplacez l'e-mail) :
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'votre-email@exemple.fr';
   ```
3. **Authentication → Providers → Email** : **désactivez « Allow new users to sign up »** (aucune inscription publique).
4. Allez sur `…/admin/login.html` et connectez-vous.

### Modèle de sécurité

- Public : lecture des lignes `is_published = true` uniquement ; insertion d'une demande de contact (statut forcé à `new`) ; **aucune lecture** de `contact_requests`.
- Écriture (concerts, setlist, matériel, affiches) : réservée aux comptes présents dans `public.admins`, vérifiée par Supabase — pas par le masquage d'URL.
- Validation côté base (contraintes `CHECK`, longueurs, format e-mail, URL http(s)) + côté navigateur.
- Anti-spam du formulaire : champ piège, délai minimal, délai entre envois (navigateur) + limite serveur de 3 demandes/heure/e-mail et 30/heure au total.
- Tous les contenus sont insérés dans le DOM via `textContent` (pas d'injection HTML) ; les liens externes sont filtrés (`http(s)` seulement) et ouverts avec `rel="noopener noreferrer"`.
- Une politique CSP est définie via `<meta>` sur chaque page.

---

## 5. Gérer les concerts depuis le téléphone

`…/admin/login.html` → **Concerts** : ajouter, modifier, publier/dépublier, supprimer (avec confirmation), téléverser/remplacer/retirer l'affiche (redimensionnée automatiquement en WebP ≤ 1600 px), lien de réservation facultatif, aperçu en direct. Les champs date et heure utilisent les sélecteurs natifs du téléphone ; l'heure saisie est celle du fuseau de l'appareil.

La setlist et le matériel se gèrent pour l'instant dans l'éditeur **Table Editor** de Supabase (tables `setlist` et `gear`).

Les demandes de contact se consultent dans **Table Editor → contact_requests** (vous pouvez changer le champ `status`).

---

## 6. Déploiement sur GitHub Pages

1. Créez un dépôt (ex. `WebSite` sous le compte `waywardship`) et poussez le contenu du dossier `joey-bfmv-tribute/` **à la racine** du dépôt.
2. **Settings → Pages** → *Deploy from a branch* → `main` / `/ (root)`.
3. Le site sera servi sur `https://joeybfmv.github.io/WebSite/` ; la page contact sur `…/WebSite/contact.html`.
4. Après changement de domaine ou de dépôt, mettez à jour `siteUrl`/`contactPageUrl` dans `js/config.js` et les balises `og:url`/`og:image`.

Tant que Supabase n'est pas configuré, le site fonctionne en **mode démo** (données fictives signalées « DÉMO ») ; supprimez-les en renseignant la configuration.

---

## 7. Test en local

```bash
cd joey-bfmv-tribute
python3 -m http.server 8080      # puis http://localhost:8080
```

---

## 8. Maintenance

- Mettre à jour un texte : `js/content.js`. Une coordonnée : `js/config.js`.
- Remplacer une image : déposer le fichier (WebP/AVIF conseillé) dans `assets/images/…` et changer son chemin.
- Le client Supabase est chargé depuis le CDN jsDelivr (`@supabase/supabase-js@2`). Pour figer la version ou l'héberger vous-même, modifiez `SUPABASE_ESM` dans `js/api.js` (et la CSP).
- Polices : pile système (aucun fichier externe). Pour une police personnalisée, déposez-la dans `assets/fonts/` et déclarez `@font-face` dans `css/global.css`.

---

## 9. Checklist avant mise en ligne

**Contenu**
- [ ] Coordonnées renseignées dans `js/config.js` (téléphone, e-mail, réseaux)
- [ ] Textes définitifs dans `js/content.js`, `placeholder` passés à `false`
- [ ] Photos réelles ajoutées, droits vérifiés, crédits indiqués
- [ ] CGU et confidentialité : tous les `[À COMPLÉTER]` remplis, **relecture juridique** faite
- [ ] Lien officiel BFMV vérifié

**Supabase**
- [ ] `schema.sql` exécuté sans erreur
- [ ] URL + clé `anon` dans `config.js` (aucune clé `service_role` nulle part)
- [ ] Compte admin créé et inscrit dans `public.admins` ; inscriptions publiques désactivées
- [ ] Test : un visiteur non connecté **ne peut pas** lire `contact_requests` (essayer l'API avec la clé anon → 0 ligne / erreur)
- [ ] Test : un concert non publié n'apparaît pas sur le site

**Fonctionnel**
- [ ] Connexion / déconnexion admin ; `admin/concerts.html` redirige vers `login.html` si déconnecté
- [ ] Ajout, modification, publication, dépublication, suppression d'un concert
- [ ] Téléversement, remplacement et retrait d'une affiche depuis un smartphone
- [ ] « Voir sur Google Maps » ouvre bien l'adresse ; « Réserver » n'apparaît que si un lien existe
- [ ] Aucun concert → message « prochaines dates à venir »
- [ ] Formulaire de contact : erreurs de validation, envoi réussi, ligne visible dans Supabase, anti-spam (2 envois rapprochés refusés)
- [ ] Tous les liens du menu et du footer fonctionnent (y compris sous `/WebSite/`)

**Qualité**
- [ ] Affichage correct : smartphone, tablette, portable, grand écran
- [ ] Menu mobile utilisable au clavier (Tab, Échap) et lecteur d'écran
- [ ] Animations réduites avec `prefers-reduced-motion`
- [ ] Lighthouse : performance, accessibilité, SEO ≥ 90
- [ ] Console du navigateur sans erreur

---

## 10. Limites connues / points d'attention

- Le fuseau horaire des dates saisies dans l'admin est celui de l'appareil ; l'affichage public est en `Europe/Paris`.
- La CSP en `<meta>` ne peut pas gérer `frame-ancestors` (non supporté en meta) : GitHub Pages n'autorise pas d'en-têtes personnalisés.
- Le texte juridique est un **modèle** : il doit être validé avant publication.
