import { useEffect } from 'react';

const EN: Record<string, string> = {
  'Tableau de bord':'Dashboard','CV Builder':'CV Builder','Lettres de motivation':'Cover letters',
  'Préparation entretien':'Interview preparation','Suivi candidatures':'Application tracking',
  'Profil carrière':'Career profile','Coaching carrière':'Career coaching','Paramètres':'Settings',
  'Retour au Dashboard':'Back to Dashboard','Rechercher dans Omnia Career...':'Search Omnia Career...',
  'Modifier la section':'Edit section','Modifier la lettre':'Edit letter','Sections du CV':'CV sections',
  'Structure de la lettre':'Letter structure','Profil':'Profile','Résumé':'Summary','Compétences':'Skills',
  'Expériences':'Experience','Formation':'Education','Certifications':'Certifications','Langues':'Languages',
  'Projets':'Projects','Centres d’intérêt':'Interests','Nom complet':'Full name','Titre professionnel':'Professional title',
  'Téléphone':'Phone','Ville / Pays':'City / Country','Photo du CV':'CV photo','Ajouter une photo':'Add photo',
  'Remplacer':'Replace','Supprimer':'Delete','Enregistrer':'Save','Enregistrer brouillon':'Save draft',
  'Télécharger PDF':'Download PDF','Plein écran':'Full screen','Éditeur libre':'Free editor','Aperçu en direct':'Live preview',
  'Modèles':'Templates','Voir en grand':'View large','Ouvrir la galerie complète':'Open full gallery',
  'Choisir un modèle de CV':'Choose a CV template','Choisir un modèle de lettre':'Choose a cover letter template',
  'Rechercher un modèle...':'Search templates...','Tous':'All','Gratuits':'Free','Premium':'Premium',
  'Compatible ATS':'ATS compatible','Design créatif':'Creative design','Sélectionné':'Selected',
  'Score d’optimisation':'Optimization score','Nommer votre CV':'Name your CV',
  'Nommer votre lettre de motivation':'Name your cover letter','Annuler':'Cancel','Document sauvegardé':'Document saved',
  'Éditeur manuel avancé':'Advanced manual editor','Ajouter':'Add','Titre':'Title','Sous-titre':'Subtitle',
  'Coordonnées':'Contact details','Photo / image':'Photo / image','Expérience':'Experience','Compétences':'Skills',
  'Badge':'Badge','Cercle photo':'Photo circle','Séparateur':'Divider','Bloc libre':'Free block','Calques':'Layers',
  'Propriétés':'Properties','Police':'Font','Taille':'Size','Interligne':'Line spacing','Couleur du texte':'Text color',
  'Arrière-plan':'Background','Largeur':'Width','Hauteur':'Height','Rotation':'Rotation','Opacité':'Opacity',
  'Dupliquer':'Duplicate','Premier plan':'Bring forward','Arrière':'Send backward','Réinitialiser':'Reset',
  'Français':'French','English':'English','Notifications':'Notifications','Jetons':'Tokens'
};

function translateTree(root: ParentNode) {
  const english = localStorage.getItem('omnia_career_language') === 'en';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  nodes.forEach(node => {
    const parent = node.parentElement;
    if (!parent || parent.closest('input,textarea,[contenteditable="true"],script,style')) return;
    const raw = node.nodeValue || '';
    const holder = parent as HTMLElement;
    const remembered = holder.dataset.omniaOriginalText;
    if (!english && remembered) { node.nodeValue = remembered; delete holder.dataset.omniaOriginalText; return; }
    if (!english) return;
    const trimmed = raw.trim();
    if (!trimmed || !EN[trimmed]) return;
    if (!remembered) holder.dataset.omniaOriginalText = raw;
    node.nodeValue = raw.replace(trimmed, EN[trimmed]);
  });
  document.documentElement.lang = 'en';
}

export function useCareerAutoTranslate() {
  useEffect(() => {
    const apply = () => {
      translateTree(document.body);
      document.documentElement.lang = localStorage.getItem('omnia_career_language') === 'en' ? 'en' : 'fr';
    };
    apply();
    const observer = new MutationObserver(records => {
      if (localStorage.getItem('omnia_career_language') !== 'en') return;
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateTree(node as ParentNode);
      }));
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('omnia-career-language-change', apply);
    window.addEventListener('storage', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('omnia-career-language-change', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);
}
