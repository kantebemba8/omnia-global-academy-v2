import { useEffect, useMemo } from 'react';
import type { CourseCardData } from '../CourseCard';
import type { LandingPageConfig, SocialNetworkItem } from '../../types/landingCms';
import type { LandingPublicPartner } from './LandingExperience';

type LandingSeoProps = {
  landingPage: LandingPageConfig;
  featuredCourses: CourseCardData[];
  socialNetworks: SocialNetworkItem[];
  partners: LandingPublicPartner[];
};

const SITE_ORIGIN = 'https://omniaglobalacademy.com';
const CANONICAL_URL = `${SITE_ORIGIN}/accueil`;
const DEFAULT_TITLE = 'Formation, compétences et opportunités — Omnia Global Academy';
const DEFAULT_DESCRIPTION = 'Omnia Global Academy réunit formations, projets, certifications vérifiables, coaching, événements en direct et opportunités professionnelles.';

function compactText(value: string | undefined | null, maximumLength: number) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !element;
  const previous = element?.getAttribute('content') ?? null;

  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => {
      if (key !== 'content') element!.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }

  element.setAttribute('content', attributes.content || '');

  return () => {
    if (created) element?.remove();
    else if (previous === null) element?.removeAttribute('content');
    else element?.setAttribute('content', previous);
  };
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const created = !element;
  const previous = element?.getAttribute('href') ?? null;

  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }

  element.href = href;

  return () => {
    if (created) element?.remove();
    else if (previous === null) element?.removeAttribute('href');
    else element?.setAttribute('href', previous);
  };
}

export function LandingSeo({ landingPage, featuredCourses, socialNetworks, partners }: LandingSeoProps) {
  const metadata = useMemo(() => {
    const hero = landingPage.sections.find(section => section.type === 'hero' && section.enabled);
    const heroTitle = compactText(hero?.title, 76);
    const title = heroTitle ? `${heroTitle} — Omnia Global Academy` : DEFAULT_TITLE;
    const description = compactText(hero?.subtitle || hero?.body, 158) || DEFAULT_DESCRIPTION;
    const sameAs = socialNetworks
      .filter(item => item.enabled && /^https?:\/\//i.test(item.url) && (item.show_homepage || item.show_footer))
      .map(item => item.url)
      .filter((url, index, values) => values.indexOf(url) === index);

    const courseItems = featuredCourses.slice(0, 8).map((course, index) => {
      const courseObject: Record<string, unknown> = {
        '@type': 'Course',
        name: course.title,
        url: `${SITE_ORIGIN}/cours/${encodeURIComponent(course.id)}`,
        provider: {
          '@type': 'EducationalOrganization',
          name: 'Omnia Global Academy',
          url: SITE_ORIGIN,
        },
      };

      if (course.short_description) courseObject.description = compactText(course.short_description, 220);
      if (course.language) courseObject.inLanguage = course.language;
      if (course.level) courseObject.educationalLevel = course.level;
      if (course.creator_name) {
        courseObject.author = { '@type': 'Person', name: course.creator_name };
      }
      if (course.is_free || Number.isFinite(course.price_xof)) {
        courseObject.offers = {
          '@type': 'Offer',
          price: course.is_free ? 0 : Math.max(0, course.price_xof),
          priceCurrency: 'XOF',
          availability: 'https://schema.org/InStock',
          url: `${SITE_ORIGIN}/cours/${encodeURIComponent(course.id)}`,
        };
      }
      if (course.total_reviews > 0 && course.average_rating > 0) {
        courseObject.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: Math.min(5, Math.max(0, course.average_rating)),
          reviewCount: course.total_reviews,
          bestRating: 5,
          worstRating: 1,
        };
      }

      return {
        '@type': 'ListItem',
        position: index + 1,
        item: courseObject,
      };
    });

    const graph: Array<Record<string, unknown>> = [
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'Omnia Global Academy',
        url: SITE_ORIGIN,
        logo: `${SITE_ORIGIN}/IMG_0349.png`,
        sameAs,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: 'Omnia Global Academy',
        url: SITE_ORIGIN,
        inLanguage: 'fr',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_ORIGIN}/catalogue?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${CANONICAL_URL}#webpage`,
        url: CANONICAL_URL,
        name: title,
        description,
        inLanguage: 'fr',
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: { '@id': `${SITE_ORIGIN}/#organization` },
      },
    ];

    if (courseItems.length > 0) {
      graph.push({
        '@type': 'ItemList',
        name: 'Formations disponibles sur Omnia Global Academy',
        itemListElement: courseItems,
      });
    }

    const featuredPartners = partners
      .filter(partner => partner.show_homepage && partner.name)
      .slice(0, 20)
      .map(partner => ({
        '@type': 'Organization',
        name: partner.name,
        ...(partner.website_url ? { url: partner.website_url } : {}),
      }));

    if (featuredPartners.length > 0) {
      graph.push({
        '@type': 'ItemList',
        name: 'Partenaires publics d’Omnia Global Academy',
        itemListElement: featuredPartners.map((partner, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: partner,
        })),
      });
    }

    return { title, description, graph };
  }, [featuredCourses, landingPage.sections, partners, socialNetworks]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = metadata.title;

    const cleanups = [
      upsertCanonical(CANONICAL_URL),
      upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description }),
      upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow, max-image-preview:large' }),
      upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' }),
      upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'fr_FR' }),
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Omnia Global Academy' }),
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title }),
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description }),
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: CANONICAL_URL }),
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: `${SITE_ORIGIN}/IMG_0349.png` }),
      upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'Logo Omnia Global Academy' }),
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' }),
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title }),
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: metadata.description }),
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: `${SITE_ORIGIN}/IMG_0349.png` }),
    ];

    const script = document.createElement('script');
    script.id = 'oga-landing-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': metadata.graph });
    document.getElementById(script.id)?.remove();
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      cleanups.reverse().forEach(cleanup => cleanup());
      script.remove();
    };
  }, [metadata]);

  return null;
}
