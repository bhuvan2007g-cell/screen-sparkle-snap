<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Pet photos live in the private `pet-images` storage bucket, referenced by storage path and
  rendered via signed URLs (`src/lib/pet-images.ts`) — public buckets are blocked in this workspace.
- Session, profile and admin state come from the `AuthProvider` in `src/lib/auth.tsx`; the profile
  row is created lazily on first authenticated load because auth-schema triggers are not allowed.
- Admin rights live only in `public.user_roles` and are checked through `public.has_role` /
  `public.is_admin` in RLS policies — never store roles on `profiles`.
- Adoption side effects (notifications, pet marked adopted, competing applications rejected) are
  database triggers, so they hold no matter which client performs the update.
