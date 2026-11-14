# CLAUDE.md — à lire en premier

Mémoire du projet pour tout assistant qui reprend le travail. Les détails sont dans :

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : fichiers, entités lues, topics MQTT, formules, notifications.
- [docs/DECISIONS.md](docs/DECISIONS.md) : choix validés par le propriétaire et choix refusés. Ne pas les remettre en cause sans demande.
- [CHANGELOG.md](CHANGELOG.md) : historique des changements.

## Le projet

Intégration Home Assistant (HACS) pour le contrôleur de piscine Flow.io (firmware `christophebelmont/Flow.io-Waveshare`). Domaine `flowio`. Elle ajoute qualité pH/ORP/eau, alertes, volumes injectés, autonomie des cuves, diagnostic et notifications. Les cartes Lovelace associées sont dans un autre dépôt.

## Règles de travail avec le propriétaire

- Langue : français, réponses courtes et directes.
- Toute écriture sur GitHub passe par une confirmation explicite avant le push (branche `main`, outil `push_files`). Les arguments du push doivent être identiques à ceux confirmés.
- Ne pas sur-concevoir : quand le propriétaire dit « ne te prends pas la tête », on garde la solution simple.
- Lire le firmware, les cartes ou la documentation de l'application Companion avant d'affirmer quoi que ce soit sur des valeurs, des topics ou des clés de notification. Ne jamais deviner. Un exemple de cette règle : le propriétaire connaissait les entités `pl_flt_start` et `pl_flt_stop` ; elles figurent dans le README des cartes.
- Rien n'est testé dans un vrai Home Assistant par l'assistant : le dire clairement dans les réponses. Le propriétaire teste sur ses appareils et rend compte.
- Le propriétaire modifie aussi le dépôt à la main (workflow, manifest, tags, images). Avant de modifier un fichier, relire sa version actuelle ; avant de parler de versions, lister les tags et les releases. Ne pas créer de tag : c'est le propriétaire qui le fait.
- Après chaque push, relire `CLAUDE.md` : tout point d'état devenu faux doit être corrigé dans le même push, pas annoncé comme fait sans l'être.
- Un push dont la confirmation n'a pas reçu de réponse n'est pas fait : vérifier avec la liste des commits avant de dire qu'il l'est.
- L'outil GitHub disponible n'envoie que du texte : les images (PNG, JPG) doivent être déposées à la main par le propriétaire.
- Format des notifications d'équipement voulu par le propriétaire (14/11/2026) : une seule première ligne (le titre) du type « Filtration : arrêt à 22:07 par le contrôleur, durée 12 min », la durée seulement à l'arrêt, sans emoji dans le titre, icône = celle de l'entité MQTT. Dessous : récapitulatif avec emojis (🧪 pH et ORP avec pastilles, 🌡️ eau et air, 📊 pression, 🧴 cuves). « Par le contrôleur » est la formulation du propriétaire quand aucune commande Home Assistant n'est trouvée, même si c'est une déduction.
- Les fichiers de texte `strings.json` et `translations/en.json` doivent rester identiques ; `fr.json` suit la même structure. Tout champ de configuration ajouté exige les trois fichiers.

## Publier une version

1. Modifier `version` dans `custom_components/flowio/manifest.json` et mettre à jour `CHANGELOG.md`.
2. Le propriétaire crée le tag `vX.Y.Z` identique à la version du manifest. Le workflow `.github/workflows/release.yml` échoue sinon.
3. Le workflow embarque les cartes (commit pinglé `CARDS_REF`), construit `flowio.zip` avec tout le dossier `custom_components/flowio/` et crée une release en brouillon (`draft: true`).
4. Publier le brouillon dans Releases. HACS ne voit la version qu'après publication.
5. Mettre à jour dans HACS, puis redémarrer Home Assistant.

## État au 14/11/2026

- Version dans le code : 0.3.6. Tags existants : v0.1.0, v0.1.1, v0.2.0 à v0.2.5, v0.3.0 et v0.3.4 (créés par le propriétaire). Les versions 0.3.1, 0.3.2, 0.3.3, 0.3.5 et 0.3.6 n'ont pas de tag. L'état de publication des releases n'a pas été vérifié.
- Le propriétaire a indiqué le 14/11/2026 que tout fonctionne avec la 0.3.6, sans détail par appareil. L'assistant n'a rien exécuté.
- Configuration depuis la 0.3.0 : `notify_service` supprimé, remplacé par `mobile_devices` (appareils de l'application mobile). Version d'entrée de configuration : 2, avec migration dans `__init__.py`. Après migration, aucun téléphone n'est choisi.
- Notifications par plateforme (`runtime.py`) : Android en HTML (`<span style="color">`, gras, italique), iPhone en texte simple avec emojis, couleur = fond de l'icône d'une notification de communication (icône `mdi` obligatoire, `mdi:pool` par défaut, glyphe blanc). Documenté dans l'application Companion ; le texte iPhone ne peut pas être coloré.
- Suivi en direct (option `notify_live`, désactivée par défaut) : filtration seulement, après 60 s de marche ; barre de progression de la plage (`pl_flt_start`, `pl_flt_stop`) rafraîchie toutes les 15 min, sinon chronomètre ; carte retirée par `clear_notification` à l'arrêt, à l'indisponibilité et au retour à l'arrêt. Barre et chronomètre ne se combinent pas. Une incertitude subsiste sur l'affichage de la barre sur Android (rapport de bug de l'application).
- Durée « inconnue » à l'arrêt : repère = `PROCESS_START` (import du module `device_notifications`), pas le chargement de l'intégration, qui est rechargée à chaque enregistrement des options.
- `notification_actions.py` : ses réponses appellent `rt.async_send(titre, message, clé)` avec trois arguments, compatible avec la signature actuelle ; le tag et le groupe sont les mêmes que ceux de l'alerte, donc la réponse la remplace bien. Non relu depuis la 0.2.5.
- Dossier `custom_components/flowio/brand/` déposé par le propriétaire : `icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png`. Les fichiers `dark_icon*.png` ne sont pas déposés : facultatifs.
- Le README, le CHANGELOG, `strings.json` et les traductions sont à jour avec le code de la 0.3.6.
