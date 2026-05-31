import { CITIES } from '../data/cityOptions.js'

/**
 * @param {{ selectedId: string | null, onSelect: (city: typeof CITIES[number]) => void }} props
 */
export default function CityPicker({ selectedId, onSelect }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[#E8D5A3]">Where will your Chinese story take place?</h2>
        <div className="mx-auto my-3 h-px w-full max-w-xs bg-[rgba(212,168,67,0.15)]" />
        <p className="text-sm text-[#8C7A52]">Pick a city to be your home:</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {CITIES.map((city) => {
          const selected = selectedId === city.id
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => onSelect(city)}
              className={[
                'rounded-lg border px-3 py-3 text-left transition',
                selected
                  ? 'border-[#D4A843] bg-[#D4A843]/10'
                  : 'border-[rgba(212,168,67,0.25)] bg-[#0F0E0C] hover:border-[#D4A843]/50',
              ].join(' ')}
            >
              <p className="text-base font-medium text-[#E8D5A3]">
                {city.hanzi}{' '}
                <span className="text-sm font-normal text-[#8C7A52]">{city.pinyin}</span>
              </p>
              <p className="mt-1 text-xs text-[#8C7A52]">{city.blurb}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
