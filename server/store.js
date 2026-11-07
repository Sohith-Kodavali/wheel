const configured = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY),
);

export const backend = configured ? 'supabase' : 'sqlite';

// Supabase is used when SUPABASE_URL and a key are set. Otherwise the
// tablet keeps working against the local SQLite file in data/.
export const store = configured ? await import('./supabase.js') : await import('./db.js');
