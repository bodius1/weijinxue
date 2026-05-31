/** Split exam sentence on （___） or (___) blank markers. */
export function splitOnBlank(text) {
  if (!text) return [text]
  const m = text.match(/（___）|\(___\)/)
  if (!m || m.index == null) return [text]
  const token = m[0]
  const i = m.index
  return [text.slice(0, i), token, text.slice(i + token.length)]
}

export function InlineBlank({ filledChar }) {
  if (filledChar) {
    return (
      <span className="mx-0.5 inline-block min-w-9 rounded-md border-[1.5px] border-[#D4A843] bg-[#D4A843]/10 px-2.5 py-0.5 text-center text-base text-[#D4A843]">
        {filledChar}
      </span>
    )
  }
  return (
    <span className="mx-0.5 inline-block min-w-9 border-b-2 border-dashed border-[#D4A843] px-2.5 text-center text-base text-[#8C7A52]">
      ___
    </span>
  )
}

export function SentenceWithBlank({ text, filledChar }) {
  const parts = splitOnBlank(text)
  if (parts.length === 1) {
    return <>{text}</>
  }
  return (
    <>
      {parts[0]}
      <InlineBlank filledChar={filledChar} />
      {parts[2] ?? ''}
    </>
  )
}
