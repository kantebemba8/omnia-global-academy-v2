-- Language architecture for courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS sous_categorie_langue VARCHAR(50),
  ADD COLUMN IF NOT EXISTS champs_sous_categorie JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS niveau_cecrl VARCHAR(5),
  ADD COLUMN IF NOT EXISTS langue_enseignee VARCHAR(50),
  ADD COLUMN IF NOT EXISTS langue_instruction VARCHAR(50),
  ADD COLUMN IF NOT EXISTS examen_oral_statut VARCHAR(60) DEFAULT 'non_propose',
  ADD COLUMN IF NOT EXISTS examen_oral_consignes TEXT,
  ADD COLUMN IF NOT EXISTS examen_oral_criteres JSONB;

-- Linguistic competences per module
ALTER TABLE course_modules
  ADD COLUMN IF NOT EXISTS competences_linguistiques TEXT[] DEFAULT '{}';

-- Audio generation text per lesson
ALTER TABLE course_lessons
  ADD COLUMN IF NOT EXISTS audio_text_to_generate TEXT,
  ADD COLUMN IF NOT EXISTS exercices_auto JSONB DEFAULT '[]';
