# Accordeur — app musique (métronome, accordeur guitare, tonalité)

## Projet
Petite app web en français, pensée pour l'iPhone (Safari) et l'ordinateur.
Fonctions, dans cet ordre : métronome → accordeur guitare (micro) → détection de note et de tonalité.
Pas de compte, pas de paiement, pas d'IA pour l'instant. Budget : 0 €.

## Stack choisie (validée)
- HTML, CSS, JavaScript simples + Vite (pas de framework)
- Web Audio (micro et métronome, intégré au navigateur)
- Pitchy (détection de hauteur de note) — à ajouter à l'étape accordeur
- Hébergement : GitHub Pages (dépôt public, déploiement automatique à chaque push sur `main`)

## Règles
- Ne change pas de techno sans me demander.
- Explique-moi en une phrase ce que tu viens de faire.
- Parle simplement, sans jargon.

## Sécurité
- Aucune clé secrète dans le code. Si un jour il en faut : fichier `.env` exclu de Git (déjà dans `.gitignore`).
- Le dépôt est public : rien de privé dedans.
- Sauvegarde : le code est sur GitHub. Un commit après chaque étape qui marche, pour pouvoir revenir en arrière.

## Étapes
1. Site vide en ligne sur GitHub Pages
2. Métronome (mesures 2/4, 3/4, 4/4, 6/8)
3. Accordeur guitare (note + trop haut / trop bas)
4. Détection de tonalité (estimation sur ~10 secondes)
Plus tard : version installable / hors connexion, connexion, autres instruments.

## Notes techniques
- iPhone : le micro et le son ne démarrent qu'après un appui sur un bouton, et le site doit être en https.
- Métronome : utiliser l'horloge de Web Audio pour le rythme, jamais un simple `setInterval` seul.
