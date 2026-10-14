# Contributor attribution

How authorship works in this repository, and the rules that keep it honest.

## How Git and GitHub record authorship

- **Author** — who wrote the change. Set from `user.name` / `user.email` in the committer's Git config
  when the commit is created.
- **Committer** — who applied the commit (differs from the author after a rebase, cherry-pick or a
  maintainer applying a patch). Both are stored in every commit.
- **GitHub contribution credit** — GitHub links a commit to an account when the author email matches a
  verified email on that account. Repository ownership does not make someone the author of other
  people's commits.
- **`Co-authored-by:` trailers** — lines at the end of a commit message that GitHub shows as additional
  authors. They are just text; they only appear if someone writes them.
- **Squash merges** — GitHub keeps the PR author as the commit author and adds co-author trailers for
  other people's commits in the PR.

## Rules for this repository

1. **Commit as yourself.** Configure your own name and email (`git config user.name` /
   `user.email`). Nobody is required to use the maintainer's identity, credentials or Git config.
2. **The owner's identity is only for the owner's own work.** The repository owner (Clint Galendez,
   `clintgalendez@gmail.com`) commits under that identity only for changes they authored or
   explicitly accepted as their own work. It is configured per repository by the owner, not globally
   by tooling.
3. **Never rewrite someone else's authorship.** Maintainers must not amend, rebase or squash in a way
   that removes an external contributor's authorship. When squashing a contributor's PR, keep them as
   the author or add a `Co-authored-by:` trailer for them.
4. **No invented identities.** Commits must not use made-up names or other people's identities.
5. **No automatic tool or AI trailers.** Tooling (including AI coding assistants) must not add itself as
   author or co-author on the owner's commits, and must not append `Co-authored-by:` trailers
   automatically. Tools must not commit or push without the owner's explicit authorization.
6. **No contribution-graph manipulation.** Don't backdate commits, forge authorship, or create commits
   whose purpose is to alter GitHub contribution records.

## What this means in practice

The owner may be the sole author of the initial commits and of anything they write themselves. Once
other people contribute, they are credited for their work, and the repository's contributor list will
include them — that is how open source should work.

## Checking authorship

```sh
git log --format='%h %an <%ae> | committer: %cn <%ce>%n%(trailers:key=Co-authored-by)'
git shortlog -sne
```

## Fixing your own mistakes

If you committed with the wrong email on an unpushed branch, you may fix **your own** commits:

```sh
git commit --amend --reset-author --no-edit   # last commit only
```

Never rewrite published history on `main`, and never change other people's commits.
