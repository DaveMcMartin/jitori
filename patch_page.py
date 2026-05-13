content = open('src/routes/+page.svelte').read()
content = content.replace('highlightTargetWord(sentence.sentence, sentence.word)', 'highlightTargetWord(sentence.sentence, detectedWord)')
open('src/routes/+page.svelte', 'w').write(content)
