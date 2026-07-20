import type { CSSProperties } from "react";

type IndexedCharacter = {
  character: string;
  index: number;
};

/**
 * Мягкое последовательное появление адреса в духе аэропортового табло.
 * Слова остаются цельными при переносе, поэтому строка не ломается посимвольно.
 */
export function SplitFlapAddress({ address }: { address: string }) {
  let characterIndex = 0;
  const tokens = address.split(/(\s+)/).map((token) => {
    const characters = Array.from(token).map<IndexedCharacter>((character) => ({
      character,
      index: characterIndex++,
    }));

    return {
      characters,
      isWhitespace: /^\s+$/.test(token),
    };
  });

  return (
    <span className="place-address-flip" aria-label={address}>
      {tokens.map((token, tokenIndex) => {
        if (token.isWhitespace) {
          return (
            <span key={`space-${tokenIndex}`} className="place-address-flip-space" aria-hidden="true">
              {token.characters.map(({ index }) => (
                <span key={index}>&nbsp;</span>
              ))}
            </span>
          );
        }

        return (
          <span key={`word-${tokenIndex}`} className="place-address-flip-word" aria-hidden="true">
            {token.characters.map(({ character, index }) => (
              <span
                key={`${address}-${index}`}
                className="place-address-flip-character"
                style={{ "--place-address-character-index": index } as CSSProperties}
              >
                {character}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
