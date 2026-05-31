/** @param {{ speaker?: { id?: string, chineseName?: string } }} props */
export function NPCAvatar({ speaker }) {
  const firstChar = speaker?.chineseName?.[0] || '?'

  const colors = ['#D4A843', '#A8956A', '#7BA821', '#5B8FB9', '#C97064']
  const hash = (speaker?.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const color = colors[hash % colors.length]

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-medium"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}66`,
      }}
    >
      {firstChar}
    </div>
  )
}
