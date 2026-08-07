import { hasUnfilledDetails, type LegalDocument } from "../legal/documents";

/*
 * Показ Политики и Пользовательского соглашения. Открывается ДО проверки входа:
 * документ должен читаться человеком, у которого ещё нет аккаунта, — он для того
 * и нужен, чтобы решить, заводить ли его вообще.
 */
export function LegalScreen({ document, onClose }: { document: LegalDocument; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div
        className="flex items-center gap-3 px-5 shrink-0 border-b border-[rgba(3,7,18,0.08)]"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: 12 }}
      >
        <button
          onClick={onClose}
          className="text-[16px] font-medium text-[#ff2d87] shrink-0"
          aria-label="Закрыть документ"
        >
          Назад
        </button>
        <h1 className="text-[16px] font-semibold text-[#030712] truncate">{document.title}</h1>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 pt-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
      >
        {hasUnfilledDetails() && (
          /*
           * Реквизиты оператора ещё не получены. Молча показать людям документ с
           * «[ЗАПОЛНИТЬ: адрес оператора]» вместо адреса — хуже, чем честно
           * сказать, что документ не дописан: по такому документу человек не
           * сможет реализовать свои права, а именно для этого адрес и нужен.
           */
          <div className="mb-5 rounded-[14px] bg-[#fff4e5] px-4 py-3 text-[14px] leading-[19px] text-[#8a4b00]">
            Документ подготовлен, но ещё не содержит полных реквизитов оператора. Это черновая
            редакция: она описывает, как Сервис работает на самом деле, но до публичного запуска
            будет дополнена и проверена юристом.
          </div>
        )}

        <p className="mb-5 text-[13px] leading-[18px] text-[#99a1af]">Редакция {document.version}</p>

        {document.blocks.map((block) => (
          <section key={block.heading} className="mb-6">
            <h2 className="mb-2 text-[17px] leading-[22px] font-semibold text-[#030712]">
              {block.heading}
            </h2>

            {block.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mb-2 text-[15px] leading-[21px] text-[#364153]">
                {paragraph}
              </p>
            ))}

            {block.list && (
              <ul className="mt-1 flex flex-col gap-1.5">
                {block.list.map((item) => (
                  <li
                    key={item}
                    className="relative pl-4 text-[15px] leading-[21px] text-[#364153]
                               before:absolute before:left-0 before:top-[9px] before:h-1 before:w-1
                               before:rounded-full before:bg-[#99a1af]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
