import { useState, useRef } from 'react';
import { COUNTRIES } from '../data/Countries';

const NIVEAUX = ['Non précisé', 'Bac', 'Bac+2', 'Bac+3', 'Bac+5', 'Doctorat'];
const LANGUES_SUGGESTIONS = ['Français', 'Anglais', 'Arabe', 'Espagnol', 'Allemand', 'Italien', 'Chinois', 'Portugais', 'Turc', 'Russe'];
const EXPERIENCE_SUGGESTIONS = ['0', '1 an', '1 à 2 ans', '2 à 3 ans', '3 à 5 ans', '5 à 10 ans', '10 ans et +'];

function TagInput({ tags, onChange, placeholder, suggestions, listId }) {
  const [input, setInput] = useState('');
  const inputRef = useRef();

  const addTag = (val) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="tag-input-box" onClick={() => inputRef.current?.focus()}>
      {tags.map((t) => (
        <span key={t} className="tag-chip">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => input.trim() && addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="tag-input-field"
        list={suggestions ? listId : undefined}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

export default function PublierOffreForm({ onPublished, onCancel, offre }) {
  const [form, setForm] = useState({
    titre: offre?.titre || '',
    entreprise: offre?.entreprise || '',
    description: offre?.description || '',
    skillsObligatoires: offre?.skillsObligatoires || [],
    skillsSouhaitees: offre?.skillsSouhaitees || [],
    experienceMin: offre?.experienceMin ?? '',
    niveauEtude: offre?.niveauEtude || 'Non précisé',
    langues: offre?.langues || [],
    salaire: offre?.salaire || '',
    pays: offre?.pays || '',
    typeContrat: offre?.typeContrat || 'Non précisé',
    statut: offre?.statut || 'ouverte',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback('');
    try {
      const { default: api } = await import('../api/axios');
      if (offre) {
        await api.put(`/offres/${offre.id}`, form);
        setFeedback(' Offre modifiée avec succès !');
      } else {
        await api.post('/offres', form);
        setFeedback(' Offre publiée avec succès !');
      }
      onPublished?.();
    } catch (err) {
      setFeedback(err.response?.data?.message || "Erreur lors de la création de l'offre");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="publish-form">
      <div className="publish-form-hint">
        Plus les compétences sont précises, plus le classement des candidats est fiable.
      </div>

      {feedback && (
        <div className={`form-feedback ${feedback.startsWith('✓') ? '' : 'form-feedback-error'}`}>
          {feedback}
        </div>
      )}

      {/* Section 1 — Le poste */}
      <div className="publish-section">
        <h4 className="publish-section-title">Le poste</h4>
        <div className="publish-row">
          <div className="form-group">
            <label>Intitulé du poste *</label>
            <input placeholder="ex: Développeur Full-Stack React / Node.js"
              value={form.titre} onChange={(e) => set('titre', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Entreprise</label>
            <input placeholder="Nom de l'entreprise"
              value={form.entreprise} onChange={(e) => set('entreprise', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Description du poste *</label>
          <textarea rows={5}
            placeholder="Missions, environnement technique, équipe..."
            value={form.description} onChange={(e) => set('description', e.target.value)} required />
          <span className="char-hint">
            {form.description.length} caractères — Ce texte sert aussi au calcul de similarité avec les CV : soyez concret sur les technologies.
          </span>
        </div>
      </div>

      {/* Section 2 — Profil recherché */}
      <div className="publish-section">
        <h4 className="publish-section-title">Le profil recherché</h4>

        <div className="form-group">
          <label>Compétences obligatoires</label>
          <TagInput
            tags={form.skillsObligatoires}
            onChange={(v) => set('skillsObligatoires', v)}
            placeholder="Ajouter une compétence puis Entrée"
          />
          <span className="field-hint">Elles pèsent le plus lourd dans le score. Un candidat qui n'en a aucune sera classé en bas.</span>
        </div>

        <div className="form-group">
          <label>Compétences souhaitées</label>
          <TagInput
            tags={form.skillsSouhaitees}
            onChange={(v) => set('skillsSouhaitees', v)}
            placeholder="Ajouter une compétence puis Entrée"
          />
          <span className="field-hint">Comptent pour moitié par rapport aux obligatoires.</span>
        </div>

        <div className="publish-row publish-row-3">
          <div className="form-group">
            <label>Expérience minimale</label>
            <input
              type="text"
              list="experience-suggestions"
              placeholder='ex: "2", "1 à 2 ans", "5 ans et +"'
              value={form.experienceMin}
              onChange={(e) => set('experienceMin', e.target.value)}
            />
            <datalist id="experience-suggestions">
              {EXPERIENCE_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
            </datalist>
            <span className="field-hint">Choisissez une suggestion ou écrivez librement (ex: "1 à 2 ans").</span>
          </div>
          <div className="form-group">
            <label>Niveau d'étude</label>
            <input
              list="niveaux-suggestions"
              placeholder="Choisissez ou écrivez le vôtre"
              value={form.niveauEtude}
              onChange={(e) => set('niveauEtude', e.target.value)}
            />
            <datalist id="niveaux-suggestions">
              {NIVEAUX.map((n) => <option key={n} value={n} />)}
            </datalist>
            <span className="field-hint">Sélectionnez une suggestion ou tapez librement (ex: "Ingénieur", "BTS").</span>
          </div>
          <div className="form-group">
            <label>Langues attendues</label>
            <TagInput
              tags={form.langues}
              onChange={(v) => set('langues', v)}
              placeholder="Français, Anglais..."
              suggestions={LANGUES_SUGGESTIONS}
              listId="langues-suggestions"
            />
            <span className="field-hint">Choisissez dans la liste ou tapez une langue puis Entrée.</span>
          </div>
        </div>
      </div>

      {/* Section 3 — Conditions */}
      <div className="publish-section">
        <h4 className="publish-section-title">Conditions et publication</h4>
        <div className="publish-row publish-row-3">
          <div className="form-group">
            <label>Salaire minimum (DT)</label>
            <input type="number" min={0} placeholder="ex: 1200"
              value={form.salaire} onChange={(e) => set('salaire', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Pays</label>
            <input
              list="pays-suggestions"
              placeholder="ex: Tunisie, France, Canada..."
              value={form.pays}
              onChange={(e) => set('pays', e.target.value)}
            />
            <datalist id="pays-suggestions">
              {COUNTRIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label>Type de contrat</label>
            <select value={form.typeContrat} onChange={(e) => set('typeContrat', e.target.value)}>
              <option value="Non précisé">Non précisé</option>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Stage">Stage</option>
              <option value="Alternance">Alternance</option>
              <option value="Freelance">Freelance</option>
            </select>
          </div>
        </div>
        <div className="publish-row">
          <div className="form-group">
            <label>Statut</label>
            <select value={form.statut} onChange={(e) => set('statut', e.target.value)}>
              <option value="ouverte">Ouverte aux candidatures</option>
              <option value="fermee">Fermée</option>
              <option value="brouillon">Brouillon</option>
            </select>
          </div>
        </div>
      </div>

      <div className="publish-form-actions">
        <button type="submit" className="btn-submit-offre" disabled={submitting}>
          {submitting ? 'Enregistrement...' : offre ? 'Enregistrer les modifications' : 'Publier l\'offre'}
        </button>
        {onCancel && (
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}