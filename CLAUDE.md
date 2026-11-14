# CLAUDE.md — à lire en premier

Mémoire du projet pour tout assistant qui reprend le travail. Les détails sont dans :

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : fichiers, entités lues, topics MQTT, formules.
- [docs/DECISIONS.md](docs/DECISIONS.md) : choix validés par le propriétaire et choix refusés. Ne pas les remettre en cause sans demande.
- [CHANGELOG.md](CHANGELOG.md) : historique des changements avec les commits.

## Le projet

Intégration Home Assistant (HACS) pour le contrôleur de piscine Flow.io (firmware `christophebelmont/Flow.io-Waveshare`). Domaine `flowio`. Elle ajoute qualité pH/ORP/eau, alertes, volumes injectés, autonomie des cuves, diagnostic et notifications. Les cartes Lovelace associées sont dans un autre dépôt.

## Règles de travail avec le propriétaire

- Langue : français, réponses courtes et directes.
- Toute écriture sur GitHub passe par une confirmation explicite avant le push (branche `main`, outil `push_files`).
- Ne pas sur-concevoir : quand le propriétaire dit « ne te prends pas la tête », on garde la solution simple.
- Lire le firmware avant d'affirmer quoi que ce soit sur ses valeurs par défaut ou ses topics. Ne jamais deviner.
- Rien n'est testé dans un vrai Home Assistant par l'assistant : le dire clairement dans les réponses.
- Le propriétaire modifie aussi le dépôt à la main (workflow, manifest, tags, images). Avant de modifier un fichier, relire sa version actuelle ; avant de parler de versions, lister les tags et les releases.
- Après chaque push, relire `CLAUDE.md` : tout point d'état devenu faux doit être corrigé dans le même push, pas annoncé comme fait sans l'être.
- Un push dont la confirmation n'a pas reçu de réponse n'est pas fait : vérifier avec la liste des commits avant de dire qu'il l'est.
- L'outil GitHub disponible n'envoie que du texte : les images (PNG, JPG) doivent être déposées à la main par le propriétaire.
- Format des notifications d'équipement voulu par le propriétaire (14/11/2026) : une seule première ligne (le titre) du type « Filtration : arrêt à 22:07 par le contrôleur, durée 12 min », la durée seulement à l'arrêt, sans emoji, icône = celle de l'entité MQTT. Dessous : récapitulatif pH/ORP, eau/air, pression.
- Les fichiers de texte `strings.json` et `translations/en.json` doivent rester identiques ; `fr.json` suit la même structure.

## Publier une version

1. Modifier `version` dans `custom_components/flowio/manifest.json` et mettre à jour `CHANGELOG.md`.
2. Créer le tag `vX.Y.Z` identique à la version du manifest. Le workflow `.github/workflows/release.yml` échoue sinon.
3. Le workflow embarque les cartes (commit pinglé `CARDS_REF`, modifié par le propriétaire le 14/11/2026), construit `flowio.zip` avec tout le dossier `custom_components/flowio/` et crée une release en brouillon (`draft: true`).
4. Publier le brouillon dans Releases. HACS ne voit la version qu'après publication.
5. Mettre à jour dans HACS, puis redémarrer Home Assistant.

## État au 14/11/2026

- Tags existants au 14/11/2026 : v0.1.0, v0.1.1, v0.2.0, v0.2.1, v0.2.2, v0.2.3, v0.2.4. L'état de publication des releases n'a pas été vérifié pour les trois dernières.
- Version préparée dans le code : 0.2.5 (retrait d'`alert_once`, icône Flow.io, niveaux d'interruption iPhone). Le tag `v0.2.5` est à créer par le propriétaire.
- Dossier `custom_components/flowio/brand/` déposé par le propriétaire le 14/11/2026 : `icon.png`, `icon@2x.png`, `logo.png` (vague seule), `logo@2x.png`. Les fichiers `dark_icon.png` et `dark_icon@2x.png` (texte clair pour le thème sombre) ont été générés mais ne sont pas déposés : facultatifs.
- Notifications iPhone : relues dans la documentation de l'application Companion (tag et groupe, boutons intégrés depuis iOS 2021.5, icône mdi et couleur en notification de communication, niveau d'interruption). Rien n'a été testé sur un iPhone.
- Le README, le CHANGELOG et `strings.json` sont à jour avec le code de la 0.2.5.
- `notification_actions.py` relu le 14/11/2026 : ses réponses appellent `rt.async_send(titre, message, clé)` avec trois arguments, compatible avec la signature actuelle ; le tag et le groupe sont les mêmes que ceux de l'alerte, donc la réponse la remplace bien. Lecture seule, rien n'a été exécuté.
- Notifications de démarrage d'équipement absentes (signalé le 14/11/2026 sur la 0.2.1) : cause non confirmée. Dans le code 0.2.0/0.2.1, la seule différence entre démarrage et arrêt était le chronomètre Android, retiré en 0.2.2. `alert_once`, présent de la 0.2.2 à la 0.2.4, rendait silencieux un démarrage remplaçant un arrêt (même tag) : retiré en 0.2.5, ne pas le remettre. À revérifier avec les journaux (niveau debug de `custom_components.flowio`) si cela persiste.
