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

- Keep application-document header instructions in the authenticated document generator and pass job-specific filename bases from job details to the shared download control, so both document types follow the same source resume and naming context.
- Keep DOCX layout in a shared browser-safe application-document formatter with explicit page geometry, semantic paragraphs, conservative overflow checks, and no silent truncation, so both downloads remain editable and consistently paginated.
- Install bounded stale-module recovery before client scripts in the root shell and reload on chunk-error retries, so outdated deployment assets do not strand users on a blank screen or create reload loops.
