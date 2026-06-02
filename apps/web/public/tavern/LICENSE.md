# Tavern Art

The `hearth.webp` panorama in this folder is generated, not photographed.

- **Model:** [fal.ai](https://fal.ai) — `fal-ai/flux-pro/v1.1-ultra`
- **Aspect:** 21:9
- **Output post-processing:** `cwebp -q 82 -m 6`
- **Generated:** 2026-06-02
- **Generator:** `services/workshop/scripts/generate_tavern_art.py` (committed alongside this repo)
- **Prompt:** see the `PROMPT` constant in that script

To regenerate (e.g. with a different seed or aspect):

```bash
cd services/workshop
source .venv/bin/activate
python scripts/generate_tavern_art.py --aspect 21:9 \
  --out ../../apps/web/public/tavern/hearth.jpg
cd ../../apps/web/public/tavern
cwebp -q 82 -m 6 hearth.jpg -o hearth.webp && rm hearth.jpg
```

The hotspot positions in
`apps/web/src/components/tavern/rooms.ts` are tuned to the
currently-committed panorama; expect to re-tune them if you regenerate.
