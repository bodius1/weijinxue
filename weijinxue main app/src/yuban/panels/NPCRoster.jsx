/** @param {{ npcs: Record<string, { chineseName?: string, pinyinName?: string, role?: string, firstMet?: string, relationship?: string }> }} props */
export default function NPCRoster({ npcs }) {
  const entries = Object.entries(npcs ?? {})
  if (entries.length === 0) {
    return <p className="text-xs text-[#8C7A52]">No one yet — start chatting to meet people.</p>
  }

  return (
    <ul className="space-y-2.5">
      {entries.slice(0, 3).map(([id, npc]) => (
        <li key={id} className="text-[13px] leading-snug text-[#E8D5A3]">
          <span className="mr-1" aria-hidden>
            👤
          </span>
          <span className="font-medium">
            {npc.chineseName}{' '}
            <span className="font-normal text-[#8C7A52]">{npc.pinyinName}</span>
          </span>
          <p className="mt-0.5 pl-5 text-xs text-[#8C7A52]">
            {formatRole(npc.role)} · met {npc.firstMet ?? 'recently'}
          </p>
        </li>
      ))}
      {entries.length > 3 ? (
        <li className="text-xs text-[#8C7A52]">+{entries.length - 3} more</li>
      ) : null}
    </ul>
  )
}

/** @param {string | undefined} role */
function formatRole(role) {
  if (!role) return 'acquaintance'
  return String(role).replace(/_/g, ' ')
}
