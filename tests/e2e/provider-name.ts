// R3-2: a provider choice is named "{provider} · {model}" ("Google Gemini · Nano Banana 2.1",
// "ComfyUI · MOSS-Image"); the provider alone when it has no model for the job. This matches
// a choice by its provider label, with or without the model after it, and nothing else. A
// provider whose label shares a word with its model ("fal.ai Seedance" + "Seedance 2.0") is
// named "fal.ai · Seedance 2.0": pass that name itself.
export function providerName(label: string): RegExp {
  const plain = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${plain}( · .+)?$`)
}
