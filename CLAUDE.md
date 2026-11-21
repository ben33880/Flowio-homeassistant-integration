# CLAUDE.md — à lire en premier

Mémoire du projet pour tout assistant qui reprend le travail. Les détails sont dans :

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : fichiers, entités lues, topics MQTT, formules, notifications, cartes.
- [docs/DECISIONS.md](docs/DECISIONS.md) : choix validés par le propriétaire et choix refusés. Ne pas les remettre en cause sans demande.
- Fonctionnalités à faire (tendance pH/ORP, dosage anormal, filtration non démarrée) et idées à prévoir : section « À faire » de [docs/DECISIONS.md](docs/DECISIONS.md).
- [docs/CARTES.md](docs/CARTES.md) : index de la documentation des cartes (fichiers dans `cards/`).
- [CHANGELOG.md](CHANGELOG.md) : historique des changements.

## Le projet

Intégration Home Assistant (HACS) pour le contrôleur de piscine Flow.io (firmware `christophebelmont/Flow.io-Waveshare`). Domaine `flowio`. Elle ajoute qualité pH/ORP/eau, alertes, volumes injectés, autonomie des cuves, diagnostic et notifications. Les cartes Lovelace associées ont leur code source dans le dossier `cards/` de ce dépôt depuis le 14/11/2026, sans version propre.

## Règles de travail avec le propriétaire

- Langue : français, réponses courtes et directes.
- Toute écriture sur GitHub passe par une confirmation explicite avant le push (branche `main`, outil `push_files`). Les arguments du push doivent être identiques à ceux confirmés.
- Ne pas sur-concevoir : quand le propriétaire dit « ne te prends pas la tête », on garde la solution simple.
- Lire le firmware, les cartes ou la documentation de l'application Companion avant d'affirmer quoi que ce soit sur des valeurs, des topics ou des clés de notification. Ne jamais deviner. Un exemple de cette règle : le propriétaire connaissait les entités `pl_flt_start` et `pl_flt_stop` ; elles figurent dans le README des cartes.
- Rien n'est testé dans un vrai Home Assistant par l'assistant : le dire clairement dans les réponses. Le propriétaire teste sur ses appareils et rend compte.
- Le propriétaire modifie aussi le dépôt à la main (workflow, manifest, tags, images, copie et nettoyage de `cards/`). Avant de modifier un fichier, relire sa version actuelle ; avant de parler de versions, lister les tags et les releases. Ne pas créer de tag : c'est le propriétaire qui le fait.
- Le dépôt `christophebelmont/flowio-home-assistant-cards` et le dépôt du firmware `christophebelmont/Flow.io-Waveshare` n'appartiennent pas au propriétaire de ce dépôt : lecture seule, jamais d'écriture. Seule la copie `cards/` de ce dépôt se modifie.
- Les cartes n'ont pas de version propre (demande du propriétaire, 14/11/2026) : ne pas en réintroduire (notes de release, changelog, numéro, installation HACS séparée).
- Après chaque push, relire `CLAUDE.md` : tout point d'état devenu faux doit être corrigé dans le même push, pas annoncé comme fait sans l'être.
- Un push dont la confirmation n'a pas reçu de réponse n'est pas fait : vérifier avec la liste des commits avant de dire qu'il l'est.
- L'outil GitHub disponible n'envoie que du texte : les images (PNG, JPG) doivent être déposées à la main par le propriétaire. Les copies et suppressions de dossiers entiers (comme `cards/`) se font en local avec Git, pas par l'outil.
- Format des notifications d'équipement voulu par le propriétaire (14/11/2026) : une seule première ligne (le titre) du type « Filtration : arrêt à 22:07 par le contrôleur, durée 12 min », la durée seulement à l'arrêt, sans emoji dans le titre, icône = celle de l'entité MQTT. Dessous : récapitulatif avec emojis (🧪 pH et ORP avec pastilles, 🌡️ eau et air, 📊 pression, 🧴 cuves). « Par le contrôleur » est la formulation du propriétaire quand aucune commande Home Assistant n'est trouvée, même si c'est une déduction.
- Les fichiers de texte `strings.json` et `translations/en.json` doivent rester identiques ; `fr.json` suit la même structure. Tout champ de configuration ajouté exige les trois fichiers.

## Publier une version

1. Modifier `version` dans `custom_components/flowio/manifest.json` et mettre à jour `CHANGELOG.md`. Les cartes n'ont rien à faire : `cards/package.json` reste à `1.0.0` et le bundle porte la version du manifest.
2. Le propriétaire crée le tag `vX.Y.Z` identique à la version du manifest. Le workflow `.github/workflows/release.yml` échoue sinon.
3. Le workflow lance `npm ci`, `npm test` et `npm run build` dans `cards/`, génère `THIRD_PARTY_NOTICES.txt` à partir des licences des dépendances de production (erreur si l'une n'a pas de licence) et les ajoute au pied du bundle, copie le tout dans `custom_components/flowio/frontend/`, construit `flowio.zip` avec tout le dossier `custom_components/flowio/` et crée une release en brouillon (`draft: true`).
4. Publier le brouillon dans Releases. HACS ne voit la version qu'après publication.
5. Mettre à jour dans HACS, puis redémarrer Home Assistant.

## État au 21/11/2026

- Dernier tag : `v0.4.2` (état de publication de la release non vérifié). La version 0.5.0 est préparée dans le code (manifest, CHANGELOG), sans tag tant que le propriétaire ne l'a pas créé. Elle ajoute les alertes « Filtration non démarrée » et « Dosage anormal » (pH, désinfectant) et les capteurs de tendance pH/ORP, testés seulement dans un Home Assistant de test (2025.1.4), pas sur les appareils du propriétaire.
- Le propriétaire a indiqué le 14/11/2026 que tout fonctionnait avec la 0.3.6, sans détail par appareil. L'assistant n'a jamais exécuté l'intégration dans un vrai Home Assistant.
- Configuration unifiée fusionnée dans `main` : 12 composants récupèrent leur préfixe d'entité depuis `flowio/config` au lieu d'un `entity_prefix` local : Filtration, Traitement, Équipements/Modes, Équipements du bassin, Alarmes, Gestion des alarmes, Panneau firmware, Sondes, Sonde individuelle, État système, Forçage et Graphique. Les anciennes configurations avec `entity_prefix`, `mqtt_topic`, `tank_slots` ou `runtime_slots` sont rejetées.
- Cartes intégrées : `cards/` est une copie, faite par le propriétaire, du commit `9977463e00e550703907d3ce7c8a380fcea31ad8` du dépôt des cartes (MIT). Le propriétaire l'a ensuite nettoyée (commit `91428a2`) : plus de `hacs.json`, de `CHANGELOG.md`, de `.github/`, de `scripts/`, de `docs/releases/`, de `docs/RELEASE.md`, `docs/HACS.md`, `docs/HACS-TROUBLESHOOTING.md` ni de `.DS_Store`. Restés : `src`, `tests`, `e2e`, `demo`, `examples`, `docs` (captures et fiches de fonctionnement), `package.json`, `package-lock.json`, `LICENSE`.
- `cards/package.json` et la version racine de `cards/package-lock.json` sont synchronisés à `1.0.0` (valeur sentinelle, sans version propre des cartes). Le script `release:prepare` est retiré.
- Workflow de release (commits `b8f226a`, `75145ce`, `4fd67dc`) : build depuis `cards/`, mentions de licences générées par le workflow lui-même. Il a produit les archives des tags `v0.3.7`, `v0.3.8`, `v0.4.0` et `v0.4.1`. Les workflows exécutent le check TypeScript, 171 tests unitaires, 141 tests Playwright et l'audit npm des dépendances de production.
- `docs/CARTES.md` indexe les `.md` des cartes, qui restent dans `cards/`. Les fiches `DESIGN`, `DEVELOPMENT`, `DISPLAY`, `INJECTIONS`, `MAINTENANCE` et `TIMING` ont été relues et alignées sur la configuration partagée.
- Configuration depuis la 0.3.0 : `notify_service` supprimé, remplacé par `mobile_devices` (appareils de l'application mobile). Version d'entrée de configuration : 2, avec migration dans `__init__.py`. Après migration, aucun téléphone n'est choisi.
- Notifications par plateforme (`runtime.py`) : Android en HTML (`<span style="color">`, gras, italique), iPhone en texte simple avec emojis, couleur = fond de l'icône d'une notification de communication (icône `mdi` obligatoire, `mdi:pool` par défaut, glyphe blanc). Documenté dans l'application Companion ; le texte iPhone ne peut pas être coloré.
- Suivi en direct (option `notify_live`, désactivée par défaut) : filtration seulement, après 60 s de marche ; barre de progression de la plage (`pl_flt_start`, `pl_flt_stop`) rafraîchie toutes les 15 min, sinon chronomètre ; carte retirée par `clear_notification` à l'arrêt, à l'indisponibilité et au retour à l'arrêt. Barre et chronomètre ne se combinent pas. Une incertitude subsiste sur l'affichage de la barre sur Android (rapport de bug de l'application).
- Durée « inconnue » à l'arrêt : repère = `PROCESS_START` (import du module `device_notifications`), pas le chargement de l'intégration, qui est rechargée à chaque enregistrement des options.
- Erreur de journal `value_json.tank.remaining_ml` (14/11/2026) : elle ne vient pas de l'intégration. Les capteurs `pd_ph_tnk_rem` et `pd_chl_tnk_rem` viennent de l'ancien firmware (`christophebelmont/flow.io`) ; le firmware Waveshare actuel ne les crée plus et publie les cuves en valeurs `data_*`. Le propriétaire possède `sensor.fio_pd_ph_tnk_rem`. Suppression de l'entité et de sa configuration retenue sur le broker : non confirmée.
- `notification_actions.py` : relu le 14/11/2026 sur `config-unifiee`. Ses réponses appellent `rt.async_send(titre, message, clé)`, compatible avec la signature actuelle ; le tag et le groupe sont les mêmes que ceux de l'alerte, donc la réponse remplace bien la notification. Aucune modification de code nécessaire.
- Dossier `custom_components/flowio/brand/` déposé par le propriétaire : `icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png`. Les fichiers `dark_icon*.png` ne sont pas déposés : facultatifs.
- La nouvelle carte Tableau de bord (`custom:flowio-pool-dashboard-card`) est compacte : qualité à gauche, équipements et traitement à droite aux largeurs intermédiaires ; modes et horaires sont repliés par défaut ; « Valeurs et télémétrie » est masquée par défaut mais reste disponible dans l’éditeur. Mesurée à 767 px dans la démo locale, sans test dans un vrai Home Assistant.
- Les notifications persistantes reprennent aussi lorsqu’un équipement revient de `unavailable` à `on`, en plus de la reprise au rechargement/redémarrage de l’intégration.
- Le README, le CHANGELOG, `strings.json` et les traductions couvrent la préparation 0.5.0.
