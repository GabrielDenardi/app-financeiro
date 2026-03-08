# Onboarding Assets (`imagegen`)

O fluxo de auth usa ilustracoes inspiradas em fintech com paleta azul (sem marca de terceiros) e fundo transparente.  
As artes finais devem ser geradas com o skill `imagegen`.

## Arquivos esperados
- `hero-onboarding.png`
- `consent-illustration.png`
- `security-illustration.png`

## Como gerar
1. Configure `OPENAI_API_KEY` no seu ambiente.
2. Execute:

```powershell
python C:/Users/Gabriel/.codex/skills/imagegen/scripts/image_gen.py generate-batch `
  --input assets/onboarding/prompts.jsonl `
  --out-dir assets/onboarding `
  --quality high `
  --output-format png `
  --background transparent
```

3. Renomeie os arquivos gerados (`image_1.png`, `image_2.png`, `image_3.png`) para os nomes esperados acima.

## Observacao
Nesta implementacao, o ambiente estava sem `OPENAI_API_KEY`, entao o codigo usa ilustracoes vetoriais internas como fallback visual.
