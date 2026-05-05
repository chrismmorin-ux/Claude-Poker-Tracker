/**
 * @file identityAvatarCorpus.jsx — Dev-only renderer for the PIO G4 v2 corpus.
 *
 * Mounts a fullscreen overlay showing all 25 corpus profiles
 * (7 anchors + 18 synthesized) as IdentityAvatars at multiple sizes,
 * alongside the input attribute summary so owner can sanity-check the
 * mapping output.
 *
 * Usage from browser console (DEV only):
 *   window.__showIdentityAvatarCorpus()
 *   window.__hideIdentityAvatarCorpus()
 *
 * Loaded automatically by main.jsx in DEV mode.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import IdentityAvatar from '../components/ui/IdentityAvatar';
import AvatarRenderer from '../components/ui/AvatarRenderer';
import {
  SKIN_TONES,
  HAIR_COLORS,
  EYEWEAR_COLORS,
} from '../constants/avatarFeatureConstants';
import { AVATAR_FEATURES } from '../assets/avatarFeatures';

// =============================================================================
// CORPUS — mirrors §4 of the audit report
// =============================================================================
//
// Each profile is the input shape that mapIdentityToAvatarFeatures consumes.
// `_meta` carries the human-readable description from the audit corpus.

const CORPUS = [
  // ===== Real anchors (from PokerNews + WSOP coverage) =====
  {
    id: 'ANCHOR-1',
    _meta: { name: 'Mizrachi', source: 'WSOP 2025', distinguishing: 'diamond bracelet' },
    sex: 'male', ethnicityTags: ['middle-eastern'], ageDecade: '50s',
    hairColor: 'gray', hairLength: 'short', facialHair: 'clean',
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'ANCHOR-2',
    _meta: { name: 'Wasnock', source: 'WSOP 2025' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '50s',
    hairColor: 'gray', hairLength: 'short', facialHair: 'clean',
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'ANCHOR-3',
    _meta: { name: 'Hallaert', source: 'WSOP 2025' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '40s',
    hairColor: 'brown', hairLength: 'short', facialHair: 'clean',
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'ANCHOR-4',
    _meta: { name: 'Dunaway', source: 'WSOP 2025' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '40s',
    hairColor: 'brown', hairLength: 'short', facialHair: 'clean',
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'ANCHOR-5',
    _meta: { name: 'Okamoto', source: 'WSOP Ladies', distinguishing: 'Japan flag' },
    sex: 'female', ethnicityTags: ['east-asian'], ageDecade: '30s',
    hairColor: 'black', hairLength: 'medium', facialHair: null,
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'ANCHOR-6',
    _meta: { name: 'Alcorn', source: 'WSOP Ladies' },
    sex: 'female', ethnicityTags: ['caucasian'], ageDecade: '40s',
    hairColor: 'brown', hairLength: 'medium', facialHair: null,
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'ANCHOR-7',
    _meta: { name: 'Hagberg', source: 'WSOP Ladies' },
    sex: 'female', ethnicityTags: ['caucasian'], ageDecade: '30s',
    hairColor: 'blonde', hairLength: 'medium', facialHair: null,
    build: 'average', eyewear: 'none', headwear: null,
  },
  // ===== Synthesized profiles (live-cash-game demographic mix) =====
  {
    id: 'SYNTH-1',
    _meta: { name: 'Hispanic 30s muscular w/ beard, cap, sleeve tattoo' },
    sex: 'male', ethnicityTags: ['hispanic'], ageDecade: '30s',
    hairColor: 'black', hairLength: 'short', facialHair: 'full',
    build: 'muscular', eyewear: 'none', headwear: 'cap',
  },
  {
    id: 'SYNTH-2',
    _meta: { name: 'Caucasian 60s+ heavy, balding, bifocals' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '60s+',
    hairColor: 'white', hairLength: 'shaved', hairTexture: 'receding', facialHair: 'clean',
    build: 'heavy', eyewear: 'readers', headwear: null,
  },
  {
    id: 'SYNTH-3',
    _meta: { name: 'East Asian 20s slim, long hair, hoodie' },
    sex: 'female', ethnicityTags: ['east-asian'], ageDecade: '20s',
    hairColor: 'black', hairLength: 'long', facialHair: null,
    build: 'slim', eyewear: 'none', headwear: null,
  },
  {
    id: 'SYNTH-4',
    _meta: { name: 'Black 40s shaved, goatee, mirrored sunglasses' },
    sex: 'male', ethnicityTags: ['black'], ageDecade: '40s',
    hairColor: 'black', hairLength: 'shaved', facialHair: 'goatee',
    build: 'average', eyewear: 'sunglasses', headwear: null,
  },
  {
    id: 'SYNTH-5',
    _meta: { name: 'Caucasian 30s, scruff, beanie + hoodie' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '30s',
    hairColor: 'brown', hairLength: 'medium', facialHair: 'stubble',
    build: 'average', eyewear: 'none', headwear: 'beanie',
  },
  {
    id: 'SYNTH-6',
    _meta: { name: 'Hispanic 50s heavy, dyed-red short, readers' },
    sex: 'female', ethnicityTags: ['hispanic'], ageDecade: '50s',
    hairColor: 'red', hairLength: 'short', facialHair: null,
    build: 'heavy', eyewear: 'readers', headwear: null,
  },
  {
    id: 'SYNTH-7',
    _meta: { name: 'South Asian 40s, mustache, clear glasses' },
    sex: 'male', ethnicityTags: ['south-asian'], ageDecade: '40s',
    hairColor: 'black', hairLength: 'short', facialHair: 'mustache',
    build: 'average', eyewear: 'clear', headwear: null,
  },
  {
    id: 'SYNTH-8',
    _meta: { name: 'Caucasian 20s blonde, snapback' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '20s',
    hairColor: 'blonde', hairLength: 'medium', facialHair: 'clean',
    build: 'slim', eyewear: 'none', headwear: 'cap',
  },
  {
    id: 'SYNTH-9',
    _meta: { name: 'Black 30s braided long' },
    sex: 'female', ethnicityTags: ['black'], ageDecade: '30s',
    hairColor: 'black', hairLength: 'long', hairTexture: 'braided', facialHair: null,
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'SYNTH-10',
    _meta: { name: 'Caucasian 50s heavy, full beard, cowboy hat' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '50s',
    hairColor: 'brown', hairLength: 'short', facialHair: 'full',
    build: 'heavy', eyewear: 'none', headwear: 'cowboy',
  },
  {
    id: 'SYNTH-11',
    _meta: { name: 'East Asian 60s+ slim, clear glasses' },
    sex: 'male', ethnicityTags: ['east-asian'], ageDecade: '60s+',
    hairColor: 'black', hairLength: 'short', facialHair: 'clean',
    build: 'slim', eyewear: 'clear', headwear: null,
  },
  {
    id: 'SYNTH-12',
    _meta: { name: 'Caucasian 60s+ gray short, sun visor' },
    sex: 'female', ethnicityTags: ['caucasian'], ageDecade: '60s+',
    hairColor: 'gray', hairLength: 'short', facialHair: null,
    build: 'average', eyewear: 'readers', headwear: 'visor',
  },
  {
    id: 'SYNTH-13',
    _meta: { name: 'Hispanic 40s slick-back, goatee' },
    sex: 'male', ethnicityTags: ['hispanic'], ageDecade: '40s',
    hairColor: 'black', hairLength: 'short', facialHair: 'goatee',
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'SYNTH-14',
    _meta: { name: 'Middle Eastern 30s curly, full beard' },
    sex: 'male', ethnicityTags: ['middle-eastern'], ageDecade: '30s',
    hairColor: 'black', hairLength: 'medium', hairTexture: 'curly', facialHair: 'full',
    build: 'average', eyewear: 'none', headwear: null,
  },
  {
    id: 'SYNTH-15',
    _meta: { name: 'Caucasian 70s+ sparse white, bifocals, hearing aids' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '60s+',
    hairColor: 'white', hairLength: 'short', facialHair: 'clean',
    build: 'slim', eyewear: 'readers', headwear: null,
  },
  {
    id: 'SYNTH-16',
    _meta: { name: 'South Asian 40s long, bindi (FUTURE: badge overlay)' },
    sex: 'female', ethnicityTags: ['south-asian'], ageDecade: '40s',
    hairColor: 'black', hairLength: 'long', facialHair: null,
    build: 'slim', eyewear: 'none', headwear: null,
  },
  {
    id: 'SYNTH-17',
    _meta: { name: 'Black 50s salt-and-pepper, military cap' },
    sex: 'male', ethnicityTags: ['black'], ageDecade: '50s',
    hairColor: 'salt-pepper', hairLength: 'short', facialHair: 'full',
    build: 'heavy', eyewear: 'none', headwear: 'cap',
  },
  {
    id: 'SYNTH-18',
    _meta: { name: 'Caucasian 30s muscular, red hair + beard' },
    sex: 'male', ethnicityTags: ['caucasian'], ageDecade: '30s',
    hairColor: 'red', hairLength: 'medium', facialHair: 'full',
    build: 'muscular', eyewear: 'none', headwear: null,
  },
];

// =============================================================================
// RENDERER
// =============================================================================

const ProfileCard = ({ profile }) => {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
        {profile.id}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {profile._meta.name}
      </div>
      {profile._meta.source ? (
        <div style={{ fontSize: 11, color: '#999' }}>
          source: {profile._meta.source}
        </div>
      ) : null}
      {/* Three sizes side-by-side: 24 (TableView seat), 48 (PlayersView row), 96 (profile/picker) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '8px 0' }}>
        <IdentityAvatar player={profile} size={24} />
        <IdentityAvatar player={profile} size={48} />
        <IdentityAvatar player={profile} size={96} />
      </div>
      {/* Headwear-overlay variant */}
      {profile.headwear ? (
        <div style={{ fontSize: 11, color: '#999' }}>
          headwear: <code>{profile.headwear}</code>
        </div>
      ) : null}
      {/* Attribute summary */}
      <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5 }}>
        <div>sex: <code>{profile.sex || '—'}</code></div>
        <div>ethnicity: <code>{(profile.ethnicityTags || []).join(', ') || '—'}</code></div>
        <div>age: <code>{profile.ageDecade || '—'}</code></div>
        <div>hair: <code>{profile.hairColor || '—'}/{profile.hairLength || '—'}</code></div>
        <div>facial: <code>{profile.facialHair || '—'}</code></div>
        <div>build: <code>{profile.build || '—'}</code></div>
        <div>eyewear: <code>{profile.eyewear || '—'}</code></div>
      </div>
      {profile._meta.distinguishing ? (
        <div style={{ fontSize: 11, color: '#a00' }}>
          ⚠ distinguishing: {profile._meta.distinguishing}
        </div>
      ) : null}
    </div>
  );
};

// =============================================================================
// FEATURE CATALOG — every option of every category visible at least once
// =============================================================================

// Render a single feature variant: a small AvatarRenderer with that specific
// feature ID set, and a name label below.
const FeatureSwatch = ({ category, featureId, label, baseFeatures = {} }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 6,
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: 6,
      minWidth: 88,
    }}
  >
    <AvatarRenderer
      avatarFeatures={{
        // For skin we set silhouette key not skin (Phase 1.6 contract)
        ...(category === 'skin' ? { silhouette: featureId } : { [category]: featureId }),
        ...baseFeatures,
      }}
      size={72}
    />
    <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'monospace', color: '#333' }}>
      {featureId}
    </div>
    {label && label !== featureId ? (
      <div style={{ fontSize: 10, color: '#888' }}>{label}</div>
    ) : null}
  </div>
);

// Render a swatch for a hair color or skin tone (just a colored circle)
const ColorSwatch = ({ id, label, hex, cssVar = '--hair' }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 6,
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: 6,
      minWidth: 88,
    }}
  >
    <AvatarRenderer
      avatarFeatures={
        cssVar === '--hair'
          ? { hair: 'hair.short-wavy', hairColor: id, beard: 'beard.full', beardColor: id }
          : cssVar === '--skin'
            ? { skin: id }
            : cssVar === '--frame'
              ? { glasses: 'glasses.round', eyewearColor: id }
              : {}
      }
      size={72}
    />
    <div
      style={{
        width: 56,
        height: 12,
        background: hex,
        borderRadius: 3,
        marginTop: 4,
        border: '1px solid #999',
      }}
    />
    <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'monospace', color: '#333' }}>
      {id}
    </div>
  </div>
);

const FeatureCatalog = () => {
  // Group hair / beard / glasses / hat — every authored feature variant.
  const hairFeatures = AVATAR_FEATURES.hair;
  const beardFeatures = AVATAR_FEATURES.beard;
  const glassesFeatures = AVATAR_FEATURES.glasses;
  const hatFeatures = AVATAR_FEATURES.hat;
  // Skin (silhouette) variants — exclude legacy 'skin.shape' singleton
  const silhouetteFeatures = AVATAR_FEATURES.skin.filter((f) => f.id.startsWith('silhouette.'));

  // For hair-color swatches, render with a face that has both hair and beard
  // so the color is visible on both surfaces.

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 14, margin: '0 0 8px 0' }}>{title}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ marginTop: 24, padding: 16, background: '#fffefa', border: '1px solid #ddd', borderRadius: 6 }}>
      <h1 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Feature Catalog — every option visible at least once</h1>
      <p style={{ fontSize: 12, color: '#555', maxWidth: 900 }}>
        Each section below shows every authored variant of one feature category. Use this to spot variants that don&apos;t read clearly at the standard 72 px display size, and reference them by the feature ID shown beneath each swatch.
      </p>

      <Section title={`Hair (${hairFeatures.length})`}>
        {hairFeatures.map((f) => (
          <FeatureSwatch key={f.id} category="hair" featureId={f.id} label={f.label} />
        ))}
      </Section>

      <Section title={`Beard / Facial hair (${beardFeatures.length})`}>
        {beardFeatures.map((f) => (
          <FeatureSwatch
            key={f.id}
            category="beard"
            featureId={f.id}
            label={f.label}
          />
        ))}
      </Section>

      <Section title={`Glasses / Eyewear (${glassesFeatures.length})`}>
        {glassesFeatures.map((f) => (
          <FeatureSwatch key={f.id} category="glasses" featureId={f.id} label={f.label} />
        ))}
      </Section>

      <Section title={`Hats / Headwear (${hatFeatures.length})`}>
        {hatFeatures.map((f) => (
          <FeatureSwatch key={f.id} category="hat" featureId={f.id} label={f.label} />
        ))}
      </Section>

      <Section title={`Silhouette — sex × build (${silhouetteFeatures.length})`}>
        {silhouetteFeatures.map((f) => (
          <FeatureSwatch key={f.id} category="skin" featureId={f.id} label={f.label} />
        ))}
      </Section>

      <Section title={`Skin tones (${SKIN_TONES.length})`}>
        {SKIN_TONES.map((c) => (
          <ColorSwatch key={c.id} id={c.id} label={c.label} hex={c.hex} cssVar="--skin" />
        ))}
      </Section>

      <Section title={`Hair colors (${HAIR_COLORS.length}) — same swatch shows beard color`}>
        {HAIR_COLORS.map((c) => (
          <ColorSwatch key={c.id} id={c.id} label={c.label} hex={c.hex} cssVar="--hair" />
        ))}
      </Section>

      <Section title={`Eyewear colors / frames (${EYEWEAR_COLORS.length})`}>
        {EYEWEAR_COLORS.map((c) => (
          <ColorSwatch key={c.id} id={c.id} label={c.label} hex={c.hex} cssVar="--frame" />
        ))}
      </Section>

      <Section title="Salt-pepper treatment (overlay on top of primary color)">
        <FeatureSwatch
          category="hair"
          featureId="hair.short-wavy"
          label="black + salt-pepper overlay"
          baseFeatures={{ hairColor: 'color.black', hairTreatment: 'salt-pepper', beard: 'beard.full', beardColor: 'color.black' }}
        />
        <FeatureSwatch
          category="hair"
          featureId="hair.medium"
          label="brown + salt-pepper overlay"
          baseFeatures={{ hairColor: 'color.brown', hairTreatment: 'salt-pepper', beard: 'beard.goatee', beardColor: 'color.brown' }}
        />
        <FeatureSwatch
          category="hair"
          featureId="hair.short-wavy"
          label="dark-brown + salt-pepper"
          baseFeatures={{ hairColor: 'color.dark-brown', hairTreatment: 'salt-pepper', beard: 'beard.stubble', beardColor: 'color.dark-brown' }}
        />
      </Section>
    </div>
  );
};

const CorpusOverlay = ({ onClose }) => {
  const anchors = CORPUS.filter((p) => p.id.startsWith('ANCHOR'));
  const synth = CORPUS.filter((p) => p.id.startsWith('SYNTH'));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f4f4f0',
        zIndex: 99999,
        overflow: 'auto',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          Identity Avatar Corpus — N=25 (Phase 1.8)
        </h1>
        <button
          onClick={onClose}
          style={{ padding: '6px 12px', background: '#333', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#555', maxWidth: 900 }}>
        Each card shows one identity rendered at 24 / 48 / 96 px (the three sizes the app uses: TableView seat / PlayersView row / profile-header). The avatar is fully derived from the identification fields shown below — no manual override. To give feedback, note the profile ID (ANCHOR-N or SYNTH-N) and what doesn&apos;t read right.
      </p>

      <FeatureCatalog />

      <h2 style={{ fontSize: 14, marginTop: 24 }}>Real anchors ({anchors.length})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        {anchors.map((p) => <ProfileCard key={p.id} profile={p} />)}
      </div>
      <h2 style={{ fontSize: 14, marginTop: 16 }}>Synthesized profiles ({synth.length})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {synth.map((p) => <ProfileCard key={p.id} profile={p} />)}
      </div>
    </div>
  );
};

// =============================================================================
// MOUNT / UNMOUNT (window helpers)
// =============================================================================

let rootEl = null;
let reactRoot = null;

const showCorpus = () => {
  if (rootEl) return; // already shown
  rootEl = document.createElement('div');
  rootEl.id = '__identity-avatar-corpus-overlay';
  document.body.appendChild(rootEl);
  reactRoot = ReactDOM.createRoot(rootEl);
  reactRoot.render(<CorpusOverlay onClose={hideCorpus} />);
  // eslint-disable-next-line no-console
  console.log('Identity Avatar Corpus mounted. Run window.__hideIdentityAvatarCorpus() to dismiss.');
};

const hideCorpus = () => {
  if (!rootEl) return;
  reactRoot?.unmount();
  rootEl?.remove();
  rootEl = null;
  reactRoot = null;
};

if (typeof window !== 'undefined') {
  window.__showIdentityAvatarCorpus = showCorpus;
  window.__hideIdentityAvatarCorpus = hideCorpus;

  // Auto-open the corpus when the URL hash is #avatar-corpus.
  // Visit http://localhost:5173/#avatar-corpus — no console required.
  // Removing the hash (or navigating away) auto-closes.
  const checkHash = () => {
    if (window.location.hash === '#avatar-corpus') {
      showCorpus();
    } else if (rootEl) {
      hideCorpus();
    }
  };
  // Run once on load (defer to next tick so app shell mounts first)
  setTimeout(checkHash, 0);
  window.addEventListener('hashchange', checkHash);
}

export { CORPUS, CorpusOverlay };
