# IronLog
A mobile-first workout tracker built with React, Vite and Supabase.

## Run locally
1. Install Node.js 18+.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the local URL printed by Vite.

The app works immediately in local mode using browser localStorage. For cloud sync:
1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in the project URL and anon/public key.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Restart Vite (`npm run dev`).
5. Open Settings and create an account or sign in.

Only use the Supabase anon/public key in the browser. Never expose a service-role key. Row Level Security is enabled and policies restrict records to their owner.

## Notes
- Workout sessions and set logs sync to Supabase when configured and authenticated.
- Without Supabase credentials, data remains in this browser's local storage.
- The included four-day program is the customized Upper A / Lower A / Upper B / Lower B plan.
