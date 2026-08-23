# Brand

Canonical character, voice, tokens, and shared homepage files live in the
[meatsack-brand](https://github.com/garylesueur/meatsack-brand) submodule at
`brand/`.

- Characters: [`brand/docs/characters.md`](../../brand/docs/characters.md)
- Voice: [`brand/docs/voice.md`](../../brand/docs/voice.md)

After updating the submodule, run `pnpm sync:brand`. Do not edit the generated
copies in `src/components/site-chrome.tsx`, `src/components/home-sections.tsx`,
or `src/app/brand.generated.css`.
