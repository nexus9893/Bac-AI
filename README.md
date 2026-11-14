# Plateforme éducative (démo)

Petit site web où :

- les **professeurs** publient des cours et des sujets (avec un fichier joint) et gèrent leur planning ;
- les **étudiants** recherchent les documents et consultent les plannings ;
- l'**administrateur** gère les matières et les professeurs.

C'est une **version de démonstration** : il n'y a pas de serveur. Les données sont enregistrées dans le navigateur de la personne qui utilise le site (`localStorage`). Aucun mot de passe n'est utilisé : le profil se choisit dans la liste en haut de la page.

## Technologies

HTML, CSS et JavaScript, sans bibliothèque externe.

## Utiliser le site en local

Ouvre simplement le fichier `index.html` dans un navigateur.

## Publier avec GitHub Pages

1. Envoie les fichiers `index.html`, `style.css`, `app.js` et `README.md` dans le dépôt.
2. Dans le dépôt, va dans **Settings → Pages**.
3. Dans **Build and deployment**, choisis **Deploy from a branch**, puis la branche `main` et le dossier `/ (root)`.
4. Après une ou deux minutes, le site est disponible à l'adresse `https://NOM-UTILISATEUR.github.io/NOM-DU-DEPOT/`.

## Sécurité (ce qui est déjà fait)

- Aucun contenu saisi par l'utilisateur n'est inséré avec `innerHTML` : le texte est toujours ajouté comme texte, ce qui évite les failles XSS.
- Politique de sécurité du contenu (CSP) dans `index.html` : seuls les scripts et styles du site sont autorisés.
- Les fichiers envoyés sont filtrés : types autorisés (PDF, PNG, JPEG, TXT, DOCX) et taille maximale de 400 Ko.
- Les liens de téléchargement sont recréés seulement si le type du fichier est autorisé.

## Limites de la démo

- Les données ne sont pas partagées entre les appareils : chaque navigateur a les siennes.
- Il n'y a pas de vraie connexion : n'importe qui peut choisir n'importe quel profil. Ne pas y mettre de données personnelles.
- Les fichiers sont limités à 400 Ko à cause de la taille du stockage du navigateur.

## Prochaines étapes possibles

1. Ajouter un vrai serveur (PHP et MySQL, ou un service comme Supabase).
2. Mettre en place de vraies connexions avec mots de passe hachés.
3. Stocker les fichiers sur le serveur au lieu du navigateur.
4. Ajouter l'arabe et l'anglais.
