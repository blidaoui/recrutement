import { useState } from 'react';
import { ImOffice } from "react-icons/im";
import { GoPersonFill } from "react-icons/go";
import { CiTimer } from "react-icons/ci";
import { GrLanguage } from "react-icons/gr";
import { PiStudentFill } from "react-icons/pi";
import { MdOutlinePriceCheck } from "react-icons/md";
import { BsPersonCheckFill } from "react-icons/bs";
import { GoCheckCircleFill } from "react-icons/go";
import { AiOutlineWechatWork } from "react-icons/ai";

export default function OffreCard({ offre, onPostuler, hasApplied, isSubmitting, onContactRecruteur }) {
  const [expanded, setExpanded] = useState(false);
  const desc = offre?.description || '';
  const MAX = 130;
  const isLong = desc.length > MAX;

  return (
    <div className={`ocard ${hasApplied ? 'ocard--applied' : ''}`}>
      <div className="ocard-accent" />

      <div className="ocard-body">
        <div className="ocard-head">
          <div className="ocard-title-block">
            <h3 className="ocard-title">{offre.titre}</h3>
            {offre.entreprise && <span className="ocard-company"><ImOffice /> {offre.entreprise}</span>}
            {offre.recruteur?.nom && !offre.entreprise && (
              <span className="ocard-company"><GoPersonFill /> {offre.recruteur.nom}</span>
            )}
          </div>
          <span className={`ocard-statut ${offre.statut === 'ouverte' ? 'ocard-statut--open' : 'ocard-statut--closed'}`}>
            {offre.statut === 'ouverte' ? 'Ouverte' : 'Fermée'}
          </span>
        </div>

        <div className="ocard-meta">
          {offre.experienceMin > 0 && (
            <span className="ocard-meta-pill"><CiTimer /> {offre.experienceMin} ans exp.</span>
          )}
          {offre.niveauEtude && offre.niveauEtude !== 'Non précisé' && (
            <span className="ocard-meta-pill"><PiStudentFill /> {offre.niveauEtude}</span>
          )}
          {offre.salaire && (
            <span className="ocard-meta-pill ocard-meta-pill--salary"><MdOutlinePriceCheck /> {offre.salaire.toLocaleString()} DT</span>
          )}
          {offre.pays && offre.pays !== 'Non précisé' && (
            <span className="ocard-meta-pill"> {offre.pays}</span>
          )}
          {offre.typeContrat && offre.typeContrat !== 'Non précisé' && (
            <span className="ocard-meta-pill ocard-meta-pill--contrat">{offre.typeContrat}</span>
          )}
          {offre.langues?.length > 0 && (
            <span className="ocard-meta-pill"><GrLanguage /> {offre.langues.join(', ')}</span>
          )}
        </div>

        <div className="ocard-desc-wrap">
          <p className="ocard-desc">
            {expanded || !isLong ? desc : `${desc.substring(0, MAX)}…`}
          </p>
          {isLong && (
            <button type="button" className="ocard-read-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Réduire ▲' : 'Lire plus ▼'}
            </button>
          )}
        </div>

        {(offre.skillsObligatoires?.length > 0 || offre.skillsSouhaitees?.length > 0 || offre.skillsRequises?.length > 0) && (
          <div className="ocard-skills">
            {offre.skillsObligatoires?.slice(0, 5).map((s) => (
              <span key={s} className="ocard-skill ocard-skill--required">{s}</span>
            ))}
            {offre.skillsSouhaitees?.slice(0, 3).map((s) => (
              <span key={s} className="ocard-skill ocard-skill--nice">{s}</span>
            ))}
            {!offre.skillsObligatoires?.length && offre.skillsRequises?.slice(0, 6).map((s) => (
              <span key={s} className="ocard-skill">{s}</span>
            ))}
          </div>
        )}
      </div>

      <div className="ocard-footer">
        <span className="ocard-candidats">
          <BsPersonCheckFill /> {offre.candidatures?.length || 0} candidature{offre.candidatures?.length !== 1 ? 's' : ''}
        </span>
        <div className="ocard-footer-actions">
          {onContactRecruteur && (
            <button
              type="button"
              className="ocard-btn ocard-btn--contact"
              onClick={() => onContactRecruteur(offre)}
              title={`Contacter ${offre.recruteur?.nom || 'le recruteur'}`}
            >
              <AiOutlineWechatWork /> Contacter
            </button>
          )}
          {hasApplied ? (
            <button className="ocard-btn ocard-btn--applied" disabled><GoCheckCircleFill /> Candidature envoyée</button>
          ) : onPostuler ? (
            <button
              className="ocard-btn ocard-btn--apply"
              disabled={isSubmitting || offre.statut !== 'ouverte'}
              onClick={() => onPostuler(offre.id)}
            >
              {isSubmitting ? ' Envoi...' : offre.statut !== 'ouverte' ? 'Offre fermée' : 'Postuler →'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
